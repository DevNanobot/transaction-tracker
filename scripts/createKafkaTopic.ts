import { Kafka, type Admin } from "kafkajs";
import { isKafkaConfigured, kafkaConfig } from "../config/kafka.js";

const NUM_PARTITIONS = 2;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function describeTopic(admin: Admin, topic: string): Promise<void> {
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
      `  partition ${partition.partitionId} leader=${partition.leader} replicas=[${partition.replicas.join(",")}]`
    );
  }
}

async function brokerIds(admin: Admin): Promise<number[]> {
  const cluster = await admin.describeCluster();
  return cluster.brokers.map((broker) => broker.nodeId).sort((a, b) => a - b);
}

async function ensureTopic(
  admin: Admin,
  topic: string,
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
    console.log(`Created topic: ${topic} (partitions=${NUM_PARTITIONS}, RF=${replicationFactor})`);
    await describeTopic(admin, topic);
    return;
  }

  console.log(`Topic already exists: ${topic}`);
  await describeTopic(admin, topic);
}

export async function ensureKafkaTopics(): Promise<void> {
  if (!isKafkaConfigured || !kafkaConfig) {
    return;
  }

  const kafka = new Kafka({
    clientId: `${kafkaConfig.clientId}-admin`,
    brokers: kafkaConfig.brokers,
  });

  const admin = kafka.admin();

  try {
    await admin.connect();

    for (let attempt = 0; attempt < 30; attempt += 1) {
      try {
        await brokerIds(admin);
        break;
      } catch (error) {
        if (attempt === 29) {
          throw error;
        }
        console.log("Waiting for Kafka broker...");
        await sleep(2000);
      }
    }

    const replicaIds = await brokerIds(admin);
    const replicationFactor = Math.max(1, replicaIds.length);

    console.log(`brokers [${replicaIds.join(",")}] rf=${replicationFactor}`);

    await ensureTopic(admin, kafkaConfig.topic, replicationFactor);
    await ensureTopic(admin, kafkaConfig.acceleratedTopic, replicationFactor);
  } finally {
    await admin.disconnect();
  }
}

const isCli = (process.argv[1] ?? "").includes("createKafkaTopic");

if (isCli) {
  if (!isKafkaConfigured || !kafkaConfig) {
    console.error("KAFKA_BROKERS is not set");
    process.exit(1);
  }

  ensureKafkaTopics().catch((error) => {
    console.error("Failed to create Kafka topic:", error);
    process.exit(1);
  });
}
