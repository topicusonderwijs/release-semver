#!/usr/bin/env node

const chalk = require('chalk');
const inquirer = require('inquirer');
const shell = require('shelljs');
const ora = require('ora');
const semver = require('semver');
const trim = require('trim');

const script = async () => {
    const options = getOptions();
    shell.config.silent = options.silent;
    shell.config.verbose = options.verbose || options.dryrun;
    welcome(options);
    gitOrQuit();

    cleanWorkdir(options);
    fetch(options);
    sourceBranchCheck(options);
    targetBranchCheck(options);
    sourceUpstreamCheck(options);
    targetUpstreamCheck(options);
    fastForwardAll(options);
    uptodateCheck(options);

    const currentVersion = latestVersion(options);
    const newVersion = await incrementVersion(currentVersion || '0.0.0');
    if (newVersion) {
        //update version in package.json ?
        //if so, do commit

        merge(newVersion, options);
        tag(newVersion, options);
        push(newVersion, options);
    }
};

const welcome = (options) => {
    console.log(chalk.black.bgGreen(`release-semver running`));
    if (options.dryrun) {
        console.log(`release-semver running in dry mode. Will fetch and checkout but not merge, tag or push.`);
    }
};

const gitOrQuit = () => {
    if (!shell.which('git')) {
        console.log(chalk.red('Could not find git, which is required for this script to run.'));
        dryRunOrNoDryRun(options, () => shell.exit(1));
    }
};

const getOptions = () => {
    const options = {
        sourceBranch: 'master',
        targetBranch: 'release',
        upstream: 'origin',
        tagPattern: '',
        prefix: false,
        silent: true,
        verbose: false,
        dryrun: false
    };

    const availableOptionKeys = ['sourceBranch', 'targetBranch', 'upstream', 'prefix', 'silent', 'verbose', 'dryrun'];
    for (let i = 2; i < process.argv.length; i++) {
        const optionKey = process.argv[i].split('--')[1];
        if (availableOptionKeys.find(val => val === optionKey)) {
            options[optionKey] = process.argv[i + 1];
        }
    }
    return options;
};

const cleanWorkdir = options => {
    const spinner = ora('Checking if working dir is clean...').start();

    const res = shell.exec(`git status --porcelain | wc -l`);
    checkShellResponse(options, spinner, res);
    if (parseInt(trim(res.stdout)) > 0) {
        spinner.fail('Working dir must be clean. Please stage and commit your changes.');
        dryRunOrNoDryRun(options, () => shell.exit(1));
    }

    spinner.succeed('Working dir is clean.');
};

const fetch = options => {
    const spinner = ora('Updating repo...').start();

    checkShellResponse(options, spinner, shell.exec(`git fetch ${options.upstream} --tags --prune`));

    spinner.succeed('Repo updated.');
};

const sourceBranchCheck = options => {
    let spinner = ora(`Checking if source branch '${options.sourceBranch}' exists...`).start();

    let res = shell.exec(`git rev-parse --verify refs/heads/${options.sourceBranch}`);
    if (res.stderr) {
        spinner.color = 'blue';
        spinner.text = `Source branch '${options.sourceBranch}' does not exist locally, checking out...`;

        checkShellResponse(options, spinner, shell.exec(`git checkout -q -B ${options.sourceBranch} ${options.upstream}/${options.sourceBranch}`));

        res = shell.exec(`git rev-parse --verify refs/heads/${options.sourceBranch}`);
        if (res.stderr) {
            spinner.fail(`Source branch '${options.sourceBranch}' does exist at upstream.`);
            dryRunOrNoDryRun(options, () => shell.exit(1));
        }
    }
    checkout(options, spinner, options.sourceBranch);
    spinner.succeed(`Source branch '${options.sourceBranch}' found.`);
};

const targetBranchCheck = options => {
    if (options.sourceBranch === options.targetBranch) {
        return;
    }

    let spinner = ora(`Checking if target branch '${options.targetBranch}' exists...`).start();
    res = shell.exec(`git rev-parse --verify refs/heads/${options.targetBranch}`);
    if (res.stderr) {
        spinner.color = 'blue';
        spinner.text = `Target branch '${options.targetBranch}' does not exist locally, checking out...`;

        checkShellResponse(options, spinner, shell.exec(`git checkout -q -B ${options.targetBranch} ${options.upstream}/${options.targetBranch}`));
        res = shell.exec(`git rev-parse --verify refs/heads/${options.targetBranch}`);
        if (res.stderr) {
            spinner.fail(`Target branch '${options.targetBranch}' does not have an upstream.`);
            dryRunOrNoDryRun(options, () => shell.exit(1));
        }
    }
    spinner.succeed(`Target branch '${options.targetBranch}' found.`);
};

const sourceUpstreamCheck = options => {
    let spinner = ora(`Checking if source branch ${options.sourceBranch} has upstream...`).start();

    res = shell.exec(`git for-each-ref --format="%(upstream:short)" refs/heads/${options.sourceBranch}`);
    checkShellResponse(options, spinner, res);
    if (options.upstream + '/' + options.sourceBranch != trim(res.stdout)) {
        spinner.fail(`Source branch '${options.sourceBranch}' does not have upstream '${options.upstream}'.`);
        dryRunOrNoDryRun(options, () => shell.exit(1));
    }
    spinner.succeed(`Source branch '${options.sourceBranch}' has upstream '${options.upstream}'.`);
};

const targetUpstreamCheck = options => {
    if (options.sourceBranch === options.targetBranch) {
        return;
    }

    let spinner = ora(`Checking if target branch ${options.targetBranch} has upstream...`).start();
    res = shell.exec(`git for-each-ref --format="%(upstream:short)" refs/heads/${options.targetBranch}`);
    checkShellResponse(options, spinner, res);
    if (options.upstream + '/' + options.targetBranch != trim(res.stdout)) {
        spinner.fail(`Target branch '${options.targetBranch}' does not have upstream '${options.upstream}'.`);
        dryRunOrNoDryRun(options, () => shell.exit(1));
    }
    spinner.succeed(`Target branch '${options.targetBranch}' has upstream '${options.upstream}'.`);
};

const fastForwardAll = (options) => {
    let spinner = ora(`Synchronizing branches...`).start();
    fastforward(options, spinner, options.sourceBranch);

    if (options.sourceBranch !== options.targetBranch) {
        fastforward(options, spinner, options.targetBranch);
        checkout(options, spinner, options.sourceBranch);
    }
    spinner.succeed('Branches synchronized');
};

const checkout = (options, spinner, branch) => {
    if (spinner) {
        spinner.color = 'blue';
        spinner.text = `Checking out ${branch}...`;
    }
    checkShellResponse(options, spinner, shell.exec(`git checkout ${branch} -q`));
};

const fastforward = (options, spinner, branch) => {
    if (spinner) {
        spinner.color = 'blue';
        spinner.text = `Fast-forwarding ${branch}...`;
    }
    checkShellResponse(options, spinner, shell.exec(`git checkout ${branch} -q`));

    let res = shell.exec(`git rev-list "refs/heads/${branch}..refs/remotes/${options.upstream}/${branch}"`);
    checkShellResponse(options, spinner, res);
    if (trim(res.stdout) !== "") {
        spinner.fail(`${branch} has local commits; can't fast-forward`);
        dryRunOrNoDryRun(options, () => shell.exit(1));
    }

    res = shell.exec(`git merge --ff-only ${options.upstream}/${branch}`);
    checkShellResponse(options, spinner, res);
};

const uptodateCheck = options => {
    if (options.sourceBranch === options.targetBranch) {
        return;
    }

    let spinner = ora(`Checking if ${options.sourceBranch} is uptodate with ${options.targetBranch}...`).start();

    const res = shell.exec(`git rev-list "${options.sourceBranch}..${options.targetBranch}" --no-merges | wc -l`);
    checkShellResponse(options, spinner, res);
    if (parseInt(trim(res.stdout)) > 0) {
        spinner.fail(`Not all commits on ${options.targetBranch} are merged back into ${options.sourceBranch}.\n` +
            `Please merge the following commits back into ${options.sourceBranch}:`);
        shell.exec(`git log --oneline --no-merges "${options.sourceBranch}..${options.targetBranch}"`, {silent: false});
        dryRunOrNoDryRun(options, () => shell.exit(1));
    }

    spinner.succeed('Everything is uptodate.');
};

const latestVersion = (options) => {
    spinner = ora(`Getting lastest version...`).start();
    let version = null;

    const ref = shell.exec(`git rev-parse --verify refs/remotes/${options.upstream}/${options.sourceBranch}`);
    checkShellResponse(options, spinner, ref);
    const tag = shell.exec(`git describe --tag ${ref}`);

    if (tag.code !== 128) {
        version = semver.valid(semver.coerce(tag.stdout, {loose: true}));
    }

    if (version) {
        spinner.succeed(`Latest version is ${version}.`);
    } else {
        spinner.info(`No version found, starting with 0.0.0.`);
    }

    return version;
};

const incrementVersion = async version => {
    const cleanVersion = semver.parse(semver.clean(version));
    if (cleanVersion) {
        const newVersion = await inquirer.prompt({
            type: 'list',
            name: 'semver',
            message: 'Select the new version:',
            choices: [
                {
                    value: semver.inc(cleanVersion.version, 'patch'),
                    name: `patch version (e.g. bug fixes): ${semver.inc(cleanVersion.version, 'patch')}`
                },
                {
                    name: `minor version (e.g. new functionality, no breaking changes): ${semver.inc(cleanVersion.version, 'minor')}`,
                    value: semver.inc(cleanVersion.version, 'minor')
                },
                {
                    name: `major version (e.g. breaking changes): ${semver.inc(cleanVersion.version, 'major')}`,
                    value: semver.inc(cleanVersion.version, 'major')
                }
            ]
        });
        return newVersion.semver;
    }
};

const merge = (newVersion, options) => {
    if (options.sourceBranch === options.targetBranch) {
        return;
    }

    let spinner = ora(`Merging ${options.sourceBranch} into ${options.targetBranch}`).start();
    checkout(options, spinner, options.targetBranch);
    const prefix = options.prefix ? options.prefix + '/' : '';
    checkShellResponse(options, spinner, shellExecOrDryrun(options, `git merge --no-ff -m "Merge branch 'master' into release for '${prefix}${newVersion}'" ${options.sourceBranch}`));

    spinner.succeed(`Merged ${options.sourceBranch} into ${options.targetBranch}`);
};

const tag = (newVersion, options) => {
    let spinner = ora(`Tagging release...`).start();
    const prefix = options.prefix ? options.prefix + '/' : '';
    checkShellResponse(options, spinner, shellExecOrDryrun(options,
        `git tag -a ${prefix}${newVersion} ${options.targetBranch} ` +
        `-m "Version ${prefix}${newVersion} released on ${new Date().toLocaleDateString()}"`));
    spinner.succeed(`Release tagged.`);
}

const push = (newVersion, options) => {
    const prefix = options.prefix ? options.prefix + '/' : '';

    let spinner = ora(`Pushing stuff to upstream '${options.upstream}'...`).start();
    if (options.sourceBranch === options.targetBranch) {
        checkShellResponse(options, spinner, shellExecOrDryrun(options, `git push ${options.upstream} ${options.sourceBranch} ${prefix}${newVersion}`));
    } else {
        checkShellResponse(options, spinner, shellExecOrDryrun(options, `git push ${options.upstream} ${options.sourceBranch} ${options.targetBranch} ${prefix}${newVersion}`));
    }

    spinner.succeed(`Things got pushed. We're done. 🎉🎉🎉`);
}

const checkShellResponse = (options, spinner, res) => {
    if (res && res.stderr && res.code !== 0) {
        if (spinner) {
            spinner.fail(`The following error occured:\n ${res.stderr}.`);
        } else {
            console.log(chalk.red.italic(`The following error occured:`));
            console.log(chalk.red(res.stderr));
        }
        dryRunOrNoDryRun(options, () => shell.exit(1));
    }
};

const dryRunOrNoDryRun = (options, callback) => {
    if (!options.dryrun) {
        callback();
    }
}

const shellExecOrDryrun = (options, exec) => {
    if (!options.dryrun) {
        return shell.exec(exec);
    }
    console.log(`dryrun: '${exec}'`);

    return null;
}

script();
