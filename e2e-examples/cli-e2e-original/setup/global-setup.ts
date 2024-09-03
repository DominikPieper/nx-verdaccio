import { executeProcess, objectToCliArgs } from '@org/test-utils';
import {
  configureRegistry,
  startVerdaccioServer,
  unconfigureRegistry,
  VercaddioServerResult,
} from '@org/tools-utils';
import { rm } from 'node:fs/promises';

const isVerbose = true; // process.env.NX_VERBOSE_LOGGING === 'true' ?? false;

let activeRegistry: VercaddioServerResult;
let stopRegistry: () => void;

export async function setup() {
  // start Verdaccio server and setup local registry storage
  const { stop, registry } = await startVerdaccioServer({
    targetName: 'original-local-registry',
    verbose: isVerbose,
    clear: true,
  });
  activeRegistry = registry;
  stopRegistry = stop;

  // configure env with verdaccio registry as default
  // exec commands:
  // - `npm config set registry "${url}"`
  // - `npm config set //${host}:${port}/:_authToken "secretVerdaccioToken"`
  configureRegistry(registry, isVerbose);

  // package publish all projects
  await executeProcess({
    command: 'nx',
    args: objectToCliArgs({
      _: ['run-many'],
      targets: 'original-npm-publish,!tag:type:testing',
      exclude: 'tag:type:testing',
      skipNxCache: true,
    }),

    verbose: isVerbose,
  });

  // package install all projects
  await executeProcess({
    command: 'nx',
    args: objectToCliArgs({
      _: ['run-many'],
      targets: 'original-npm-install',
      exclude: 'tag:type:testing',
      skipNxCache: true,
    }),
    verbose: isVerbose,
  });
}

export async function teardown() {
  // uninstall all projects
  await executeProcess({
    command: 'nx',
    args: objectToCliArgs({
      _: ['run-many'],
      targets: 'original-npm-uninstall',
    }),
    verbose: isVerbose,
  });
  stopRegistry();
  // exec commands:
  // - `npm config delete //${host}:${port}/:_authToken`
  // - `npm config delete registry`
  unconfigureRegistry(activeRegistry, isVerbose);
  await rm(activeRegistry.storage, { recursive: true, force: true });
  await rm('local-registry', { recursive: true, force: true });
}
