import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtempSync,rmSync,existsSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {validPassword} from '../server/password-policy.js';
test('password minimum, uppercase and special character requirements',()=>{
  for(const value of ['Abcdef!g','ABCDEFG!','A!'+ 'a'.repeat(254)]) assert.equal(validPassword(value),true);
  for(const value of ['Abcde!g','abcdef!g','Abcdefgh','Abcdefg ','Abcdef가나','A!'+ 'a'.repeat(255),null]) assert.equal(validPassword(value),false);
});
test('account provisioning enforces policy before writing the private database',()=>{
  const dir=mkdtempSync(join(tmpdir(),'studio-password-'));
  try {
    const run=password=>spawnSync(process.execPath,['tools/account.js','test-user'],{input:password,encoding:'utf8',env:{...process.env,DATA_DIR:dir}});
    assert.notEqual(run('abcdef!g').status,0);
    assert.equal(existsSync(join(dir,'studio.sqlite')),false);
    assert.equal(run('Abcdef!g').status,0);
  } finally {rmSync(dir,{recursive:true,force:true});}
});
