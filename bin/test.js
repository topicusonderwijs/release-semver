const shell = require("shelljs");

const tags = shell.exec(`git tag --sort=taggerdate`, { silent: true });
const regex = new RegExp(/.*(v)?(\d+\.\d+\.\d+)/);

const tag = tags.stdout
  .split("\n")
  .filter((a) => regex.test(a))
  .pop();

console.log(tag);
