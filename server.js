//const Blockchain = require('./dbchain');
//const Block = require('./dbchain');
const {Block, Blockchain} = require('./dbchain');

const express = require('express');
var bodyParser = require('body-parser');

async function start() {
  const bc = new Blockchain();
  await bc.init();
  const app = express();

  // Parsing application/json data inputs
  app.use(bodyParser.json());

  app.get('/block/:id', async function (req, res) {
    const block = await bc.getBlock(req.params.id);
    res.send(block)
  });

  app.post('/block', async function (req, res) {
    if (typeof req.body.body !== 'string') {
      res.status(400).send({ error: 'Request requires a body key populated with string data' });
    }

    await bc.addBlock(new Block(req.body.body));
    const height = await bc.getBlockHeight();
    const newBlock = await bc.getBlock(height-1);
    res.send(newBlock);
  });

  app.listen(8000, () => console.log('App listening on port 8000!'))
}

start();
