/**
 * To be used when changing normalizer settings.
 * this script can be run simply to change the underlying normalizer.
 * Invoking this script closes the index, applies updated settings, 
 * reopens the index, and then triggers a reindex, applying updated
 * normalization to all documents.
 *
 * See #usage for invocation example
 *  */

const elasticsearch = require("../lib/elastic-search/client");
const {
  indexSettings,
} = require("../lib/elastic-search/index-config/index-settings");
const fs = require("fs");
const { config } = require("dotenv");
const argv = require("minimist");

const die = (message) => {
  console.log("Error: " + message);
  process.exit(1);
};

const usage = () => {
  console.log(
    "Usage: node scripts/update-normalizers.js --index [indexName] --envfile [path/to/env]",
  );
  return true;
};

const updateSettings = async (options) => {
  const esClient = await elasticsearch.client();
  console.log(`closing index ${options.index}`);
  await esClient.indices.close({
    index: options.index,
  });
  console.log(`Updating ${options.index} settings`);
  const response = await esClient.indices.putSettings({
    index: options.index,
    body: { analysis: indexSettings.analysis },
  });
  console.log("Update request response: ");
  console.log("\t", response);

  console.log(`reopening index ${options.index}`);
  await esClient.indices.open({
    index: options.index,
  });
};

const reindexRecordsWithNewSettings = async (options) => {
  const esClient = await elasticsearch.client();
  const resp = await esClient.updateByQuery({
    index: options.index,
    conflicts: "proceed",
    wait_for_completion: false,
    body: { query: { match_none: {}  } },
    requests_per_second: 100,
  });
  console.log(`Started reindex task ${resp.body.task}`);
};

const isCalledViaCommandLine = /scripts\/update-normalizers(.ts)?/.test(
  fs.realpathSync(process.argv[1]),
);
if (isCalledViaCommandLine) {
  const args = argv(process.argv.slice(2));
  if (!args.envfile) usage() && die("--envfile required");
  if (!args.index) usage() && die("--index required");

  config({ path: args.envfile });
  updateSettings(args).then(() => {
    reindexRecordsWithNewSettings(args);
  });
}
