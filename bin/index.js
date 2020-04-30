#!/usr/bin/env node

const chalk = require('chalk');
const inquirer = require('inquirer');
const shell = require('shelljs');
const ora = require('ora');
const semver = require('semver');
const trim = require('trim');

const script = async () => {
    welcome();
    gitOrQuit();
    const options = getOptions();
    shell.config.silent = options.silent;
    shell.config.verbose = options.verbose;

    cleanWorkdir(options);
    refresh(options.upstream);

    await branchCheck(options);
    await upstreamCheck(options);

    let spinner = ora(`Synchronizing branches...`).start();
    checkout(spinner, options.sourceBranch);
    fastforward(spinner, options.sourceBranch);
    checkout(spinner, options.targetBranch);
    fastforward(spinner, options.targetBranch);
    checkout(spinner, options.sourceBranch);
    spinner.succeed('Branches synchronized');

    uptodateCheck(options);

    const currentVersion = latestVersion(spinner, options);
    const newVersion = await incrementVersion(currentVersion || '0.0.0');
    if (newVersion) {
        //update version in package.json ?
        //if so, do commit

        merge(options);
        tag(newVersion, options);
        push(newVersion, options);
    }
};

const welcome = () => {
    console.log(chalk.black.bgGreen(`release-semver v1.0.0 running`));
};

const gitOrQuit = () => {
    if (!shell.which('git')) {
        console.log(chalk.red('Could not find git, which is required for this script to run.'));
        shell.exit(1);
    }
};

const getOptions = () => {
    const options = {
        sourceBranch: 'master',
        targetBranch: 'release',
        upstream: 'origin',
        merge: true,
        tag: true,
        tagPattern: '',
        prefix: false,
        silent: true,
        verbose: false
    };

    const availableOptionKeys = ['sourceBranch', 'targetBranch', 'upstream', 'merge', 'tag', 'prefix', 'silent', 'verbose'];
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
    checkShellResponse(spinner, res);
    if (parseInt(trim(res.stdout)) > 0) {
        spinner.fail('Working dir must be clean. Please stage and commit your changes.');
        shell.exit(1);
    }

    spinner.succeed('Working dir is clean.');
};

const refresh = upstream => {
    const spinner = ora('Updating repo...').start();

    checkShellResponse(spinner, shell.exec(`git fetch ${upstream} --tags --prune`));

    spinner.succeed('Repo updated.');
};

const branchCheck = async options => {
    let spinner = ora(`Checking if source branch '${options.sourceBranch}' exists...`).start();

    let res = shell.exec(`git rev-parse --verify refs/heads/${options.sourceBranch}`);
    if (res.stderr) {
        spinner.color = 'blue';
        spinner.text = `Source branch '${options.sourceBranch}' does not exist locally, checking out...`;

        checkShellResponse(spinner, shell.exec(`git checkout -q -B ${options.sourceBranch} ${options.upstream}/${options.sourceBranch}`));

        res = shell.exec(`git rev-parse --verify refs/heads/${options.sourceBranch}`);
        if (res.stderr) {
            spinner.fail(`Source branch '${options.sourceBranch}' does exist at upstream.`);
            shell.exit(1);
        }
    }
    checkout(spinner, options.sourceBranch);
    spinner.succeed(`Source branch '${options.sourceBranch}' found.`);

    spinner = ora(`Checking if target branch '${options.targetBranch}' exists...`).start();
    res = shell.exec(`git rev-parse --verify refs/heads/${options.targetBranch}`);
    if (res.stderr) {
        spinner.color = 'blue';
        spinner.text = `Target branch '${options.targetBranch}' does not exist locally, checking out...`;

        checkShellResponse(spinner, shell.exec(`git checkout -q -B ${options.targetBranch} ${options.upstream}/${options.targetBranch}`));
        res = shell.exec(`git rev-parse --verify refs/heads/${options.targetBranch}`);
        if (res.stderr) {
            spinner.fail(`Target branch '${options.targetBranch}' does not have an upstream.`);
            shell.exit(1);
        }
    }
    spinner.succeed(`Target branch '${options.targetBranch}' found.`);
};

const upstreamCheck = async options => {
    let spinner = ora(`Checking if source branch ${options.sourceBranch} has upstream...`).start();

    res = shell.exec(`git for-each-ref --format="%(upstream:short)" refs/heads/${options.sourceBranch}`);
    checkShellResponse(spinner, res);
    if (options.upstream + '/' + options.sourceBranch != trim(res.stdout)) {
        spinner.fail(`Source branch '${options.sourceBranch}' does not have upstream '${options.upstream}'.`);
        shell.exit(1);
    }
    spinner.succeed(`Source branch '${options.sourceBranch}' has upstream '${options.upstream}'.`);

    spinner = ora(`Checking if target branch ${options.targetBranch} has upstream...`).start();
    res = shell.exec(`git for-each-ref --format="%(upstream:short)" refs/heads/${options.targetBranch}`);
    checkShellResponse(spinner, res);
    if (options.upstream + '/' + options.targetBranch != trim(res.stdout)) {
        spinner.fail(`Target branch '${options.targetBranch}' does not have upstream '${options.upstream}'.`);
        shell.exit(1);
    }
    spinner.succeed(`Target branch '${options.targetBranch}' has upstream '${options.upstream}'.`);
};

const checkout = (spinner, branch) => {
    if (spinner) {
        spinner.color = 'blue';
        spinner.text = `Checking out ${branch}...`;
    }
    checkShellResponse(spinner, shell.exec(`git checkout ${branch} -q`));
};

const fastforward = (spinner, branch) => {
    if (spinner) {
        spinner.color = 'blue';
        spinner.text = `Fast-forwarding ${branch}...`;
    }
    checkShellResponse(spinner, shell.exec(`git fast-forward ${branch}`));
};

const uptodateCheck = options => {
    let spinner = ora(`Checking if ${options.sourceBranch} is uptodate with ${options.targetBranch}...`).start();

    const res = shell.exec(`git rev-list "${options.upstream}/${options.sourceBranch}..${options.upstream}/${options.targetBranch}" --no-merges | wc -l`);
    checkShellResponse(spinner, res);
    if (parseInt(trim(res.stdout)) > 0) {
        spinner.fail(`Not all commits on ${options.targetBranch} are merged back into ${options.sourceBranch}.\n` +
            `Please merge the following commits back into ${options.sourceBranch}:`);
        shell.exec(`git log --oneline --no-merges "${options.upstream}/${options.sourceBranch}..${options.upstream}/${options.targetBranch}"`, {silent: false});
        shell.exit(1);
    }

    spinner.succeed('Everything is uptodate.');
};

const latestVersion = (options) => {
    spinner = ora(`Getting lastest version...`).start();
    let version = null;

    const ref = shell.exec(`git rev-parse --verify refs/remotes/${options.upstream}/${options.sourceBranch}`);
    checkShellResponse(spinner, ref);
    const tag = shell.exec(`git describe --tag ${ref}`);
    checkShellResponse(spinner, tag);

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

const merge = (options) => {
    let spinner = ora(`Merging ${options.sourceBranch} into ${options.targetBranch}`).start();
    checkout(spinner, options.targetBranch);
    checkShellResponse(spinner, shell.exec(`git merge --no-ff --no-edit ${options.sourceBranch}`));

    spinner.succeed(`Merged ${options.sourceBranch} into ${options.targetBranch}`);
};

const tag = (newVersion, options) => {
    let spinner = ora(`Tagging release...`).start();
    const prefix = options.prefix ? options.prefix + '/' : '';
    checkShellResponse(spinner, shell.exec(
        `git tag -a ${prefix}${newVersion} ${options.targetBranch} ` +
        `-m "Version ${prefix}${newVersion} released on ${new Date().toLocaleDateString()}"`));
    spinner.succeed(`Release tagged.`);
}

const push = (newVersion, options) => {
    const prefix = options.prefix ? options.prefix + '/' : '';

    let spinner = ora(`Pushing ${options.sourceBranch} ${options.targetBranch} ${prefix}${newVersion} to upstream '${options.upstream}'...`).start();
    checkShellResponse(spinner, shell.exec(`git push ${options.upstream} ${options.sourceBranch} ${options.targetBranch} ${prefix}${newVersion}`));
    spinner.succeed(`Things got pushed. We're done. 🎉🎉🎉`);
}

const checkShellResponse = (spinner, res) => {
    if (res.stderr && res.code !== 0) {
        if (spinner) {
            spinner.fail(`The following error occured:\n ${res.stderr}.`);
        } else {
            console.log(chalk.red.italic(`The following error occured:`));
            console.log(chalk.red(res.stderr));
        }
        shell.exit(1);
    }
};

script();
