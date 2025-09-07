// test-auth.ts
import { BigQuery } from '@google-cloud/bigquery';
import { Storage } from '@google-cloud/storage';

const bigquery = new BigQuery();
const storage = new Storage();

async function testAuth() {
  try {
    const [datasets] = await bigquery.getDatasets();
    console.log('BigQuery datasets:', datasets.map(d => d.id));
    const [buckets] = await storage.getBuckets();
    console.log('Storage buckets:', buckets.map(b => b.name));
  } catch (error) {
    console.error('Auth test failed:', error);
  }
}
testAuth();