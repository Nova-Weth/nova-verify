#!/usr/bin/env node

import { Command } from 'commander';
import { proofCommand } from './commands/proof';
import { deployCommand } from './commands/deploy';
import { verifyCommand } from './commands/verify';
import { authCommand } from './commands/auth';

const program = new Command();

program
  .name('nova-verify')
  .description('CLI tool for Nova Verify platform')
  .version('1.0.0');

// Add commands
program.addCommand(proofCommand);
program.addCommand(deployCommand);
program.addCommand(verifyCommand);
program.addCommand(authCommand);

program.parse();