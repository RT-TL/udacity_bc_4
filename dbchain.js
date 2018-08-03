/*
global setup of the databse, initially checking if empty. If so, create genesis block
then provide database functions in seperate file
 */
// async function => promise generator instead of regular return

const SHA256 = require('crypto-js/sha256');
const db = require('./database');

class Block{
  constructor(data){
    this.hash = "",
      this.height = 0,
      this.body = data,
      this.time = 0,
      this.previousBlockHash = ""
  }
}

/**
 * Blockchain class is used to create and interact with the chain.
 * The creation process is asynchronous, ensuring that the first block
 * is the gensis block.
 *
 * To connect the blockchain_old to the database, call init() first, otherwise
 * interacting with the chain will not be possible.
 *
 */
class Blockchain {
  constructor () {
  }

  /**
   * Initializes the blockchain_old generating the genesis block if needed.
   * Without calling init() the blockchain_old will not be connected to a database.
   *
   * @returns {Promise<void>}
   */
  async init () {
    this.chain = await new db('./blockchain_old');
    const empty = await this.chain.isEmpty();
    if (empty) {
      console.log('generating genesis block');
      await this.addBlock(new Block('my genesis block')).catch( () => {
        throw new Error('Could not create genesis block');
      });
    }
  }

  /**
   *
   * @param newBlock
   * @returns {Promise<boolean>}
   */
  async addBlock(newBlock){
    if (!this.chain) {
      throw new Error('You need to call init() to initialize the database first.');
    }

    newBlock.height = await this.getBlockHeight();
    newBlock.time = new Date().getTime().toString().slice(0,-3);

    // Non-genesis blocks need additional values, e.g. previous hash
    newBlock.previousBlockHash = '';
    if(newBlock.height > 0 ) {
      const prevBlock = await this.getBlock(newBlock.height - 1);
      newBlock.previousBlockHash = prevBlock.hash;
    }

    // Block hash with SHA256 using newBlock and converting to a string
    newBlock.hash = SHA256(JSON.stringify(newBlock)).toString();

    // Adding block object to chain
    if (!await this.chain.addLevelDBData(newBlock.height, newBlock)) {
      console.log('Could not add block');
      return false;
    }

    console.log('Block added');
    return true;
  }

  /**
   *
   * @param blockHeight
   * @returns {Promise<boolean>}
   */
  async validateBlock(blockHeight){
    // get block object
    let block = await this.getBlock(blockHeight);

    // get block hash
    let blockHash = block.hash;

    // remove block hash to test block integrity
    block.hash = '';
    // generate block hash
    let validBlockHash = SHA256(JSON.stringify(block)).toString();
    // Compare

    if (blockHash===validBlockHash) {
      console.log('Block #'+blockHeight+' valid');
      return true;
    } else {
      console.log('Block #'+blockHeight+' invalid hash:\n'+blockHash+'<>'+validBlockHash);
      return false;
    }
  }

  /**
   *
   * @returns {Promise<void>}
   */
  async validateChain(){
    let errorLog = [];

    const height = await this.getBlockHeight();
    for (var i = 0; i < height; i++) {
      // validate block
      console.log('Validating: ', i);
      if (!await this.validateBlock(i)) errorLog.push(i);

      // Do not validate previous hash for last block on the chain
      if (i < (height - 1)) {
        let blockHash = (await this.getBlock(i)).hash;
        let previousHash = (await this.getBlock(i + 1)).previousBlockHash;
        if (blockHash !== previousHash) {
          errorLog.push(i);
        }
      }
    }

    if (errorLog.length>0) {
      console.log('Block errors = ' + errorLog.length);
      console.log('Blocks: '+errorLog);
    } else {
      console.log('No errors detected');
    }
  }

  /**
   *
   * @returns {Promise<int, Error>}
   */
  async getBlockHeight(){
    return await this.chain.getLength().catch( error => {
      console.log(error);
    });
  }

  /**
   *
   * @param blockHeight: int index of block in the chain, starting from 0 (Genesis Block)
   * @returns {Promise<Object>}
   */
  async getBlock(blockHeight){
    const data = await this.chain.getLevelDBData(blockHeight).catch(() => {
      return null;
    });
    return data;
  }

}

module.exports = {
  Block, Blockchain
};
//module.exports = Blockchain;
/*
var bc = new Blockchain();
async function test() {

  // Adding a block before init will fail. Genesis block comes first!
  await bc.addBlock(new Block('test')).catch(error => {console.log(error)});

  await bc.init();
  await bc.addBlock(new Block('Remember, remember!'));
  await bc.addBlock(new Block('The fifth of November,'));
  await bc.addBlock(new Block('The Gunpowder treason and plot;'));
  await bc.addBlock(new Block('I know of no reason'));
  await bc.addBlock(new Block('Why the Gunpowder treason'));
  await bc.addBlock(new Block('Should ever be forgot!'));
  await bc.addBlock(new Block('Guy Fawkes and his companions'));
  await bc.addBlock(new Block('Did the scheme contrive,'));
  await bc.addBlock(new Block('To blow the King and Parliament'));
  await bc.addBlock(new Block('All up alive.'));
  bc.chain.printAll();
  bc.validateChain();
  bc.validateBlock(7);
}

test();*/