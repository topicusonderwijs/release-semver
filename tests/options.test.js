const { getOptions } = require("../bin/functions.js");
const options = require("./helpers/options.js");

test("getOptions returns default options object when called without parameters", () => {
  expect(JSON.stringify(getOptions())).toBe(JSON.stringify(options));
});

test("getOptions returns a modified object when provided with parameters", () => {
  process.argv = [
    "node",
    "jest",
    "--sourceBranch",
    "prod",
    "--targetBranch",
    "main",
    "--upstream",
    "up",
    "--prefix",
    "release",
    "--silent",
    false,
    "--verbose",
    true,
    "--dryrun",
    true
  ];
  const newOptions = {
    ...options,
    sourceBranch: "prod",
    targetBranch: "main",
    upstream: "up",
    prefix: "release",
    silent: false,
    verbose: true,
    dryrun: true
  };
  expect(JSON.stringify(getOptions())).toBe(JSON.stringify(newOptions));
});
