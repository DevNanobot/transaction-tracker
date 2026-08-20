import { Kafka, type Admin } from "kafkajs";
import { isKafkaConfigured, kafkaConfig } from "../config/kafka.js";

const NUM_PARTITIONS = 2;
const BASE_REPLICATION_FACTOR = 3;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function describeTopic(
  admin: Admin,
  topic: string
): Promise<{
  partitionCount: number;
  replicationFactor: number;
  replicaSets: number[][];
}> {
  const metadata = await admin.fetchTopicMetadata({ topics: [topic] });
  const topicMeta = metadata.topics.find((entry) => entry.name === topic);

  if (!topicMeta) {
    throw new Error(`No metadata for topic: ${topic}`);
  }

  const partitions = [...topicMeta.partitions].sort(
    (a, b) => a.partitionId - b.partitionId
  );
  const replicationFactor = partitions[0]?.replicas.length ?? 0;

  console.log(
    `Topic ${topic}: ${partitions.length} partitions, RF=${replicationFactor}`
  );

  for (const partition of partitions) {
    console.log(
      `  partition ${partition.partitionId} leader=${partition.leader} replicas=[${partition.replicas.join(",")}] isr=[${partition.isr.join(",")}]`
    );
  }

  return {
    partitionCount: partitions.length,
    replicationFactor,
    replicaSets: partitions.map((partition) => [...partition.replicas]),
  };
}

async function brokerIds(admin: Admin): Promise<number[]> {
  const cluster = await admin.describeCluster();
  return cluster.brokers.map((broker) => broker.nodeId).sort((a, b) => a - b);
}

function sameReplicas(current: number[][], target: number[]): boolean {
  return current.every((replicas) => {
    if (replicas.length !== target.length) {
      return false;
    }

    const sorted = [...replicas].sort((a, b) => a - b);
    return sorted.every((id, index) => id === target[index]);
  });
}

async function expandReplicas(
  admin: Admin,
  topic: string,
  partitionCount: number,
  replicaIds: number[]
): Promise<void> {
  console.log(
    `Adding replicas on brokers [${replicaIds.join(",")}] without deleting ${topic}`
  );

  await admin.alterPartitionReassignments({
    topics: [
      {
        topic,
        partitionAssignment: Array.from({ length: partitionCount }, (_, partition) => ({
          partition,
          replicas: replicaIds,
        })),
      },
    ],
  });

  for (let attempt = 0; attempt < 40; attempt += 1) {
    const layout = await describeTopic(admin, topic);
    if (sameReplicas(layout.replicaSets, replicaIds)) {
      return;
    }
    await sleep(500);
  }

  console.warn("Replica reassignment is still running; check kafka:describe in a moment.");
}

async function ensureTopic(
  admin: Admin,
  topic: string,
  replicaIds: number[],
  replicationFactor: number
): Promise<void> {
  const existingTopics = await admin.listTopics();

  if (!existingTopics.includes(topic)) {
    await admin.createTopics({
      topics: [
        {
          topic,
          numPartitions: NUM_PARTITIONS,
          replicationFactor,
        },
      ],
    });
    console.log(`Created topic: ${topic}`);
    await describeTopic(admin, topic);
    return;
  }

  const layout = await describeTopic(admin, topic);

  if (layout.partitionCount !== NUM_PARTITIONS) {
    console.warn(
      `Topic ${topic} has ${layout.partitionCount} partitions (wanted ${NUM_PARTITIONS}). Not deleting it.`
    );
  }

  if (replicaIds.length >= 3 && !sameReplicas(layout.replicaSets, replicaIds)) {
    await expandReplicas(admin, topic, layout.partitionCount, replicaIds);
    await describeTopic(admin, topic);
    return;
  }

  console.log(`Topic already exists: ${topic}`);
}

async function createTopics(): Promise<void> {
  if (!isKafkaConfigured || !kafkaConfig) {
    console.error("KAFKA_BROKERS is not set — nothing to do.");
    process.exit(1);
  }

  const kafka = new Kafka({
    clientId: `${kafkaConfig.clientId}-admin`,
    brokers: kafkaConfig.brokers,
  });

  const admin = kafka.admin();

  try {
    await admin.connect();

    const replicaIds = await brokerIds(admin);
    const replicationFactor = Math.max(
      BASE_REPLICATION_FACTOR,
      Math.min(3, replicaIds.length)
    );

    await ensureTopic(admin, kafkaConfig.topic, replicaIds, replicationFactor);
    await ensureTopic(
      admin,
      kafkaConfig.acceleratedTopic,
      replicaIds,
      replicationFactor
    );
  } finally {
    await admin.disconnect();
  }
}

createTopics().catch((error) => {
  console.error("Failed to create Kafka topic:", error);
  process.exit(1);
});
