const express = require('express');
const bodyParser = require('body-parser');
const bitcoin = require('bitcoinjs-lib');
const bitcoinMessage = require('bitcoinjs-message');
const {Block, Blockchain} = require('./dbchain');
const db = require('./database');

async function start() {
  const bc = new Blockchain();
  const requestDb = new db('requests');
  await bc.init();
  const app = express();

  // Parsing application/json data inputs
  app.use(bodyParser.json({type: 'application/json'}));

  /**
   * Validates if signature is correct for the passed stored request object.
   * Sets the stored requests signed state to "true" in the database.
   *
   * @param storedRequest
   * @param signature
   * @returns boolean false or updatedRequest object
   */
  async function validateMessage(storedRequest, signature) {
    let verified = false;
    try {
      verified = bitcoinMessage.verify(storedRequest.message, storedRequest.address, signature)
    } catch(e) {
      console.log(e);
      return false;
    }

    if (!verified) {
      return false;
    }

    // Set stored request to signed state
    let updatedRequest = storedRequest;
    updatedRequest.messageSignature = 'valid';
    await requestDb.addLevelDBData(storedRequest.address, updatedRequest);

    updatedRequest = updateLifetimeFor(updatedRequest);
    return updatedRequest;
  }

  /**
   * Injects remaining lifetime for request
   *
   * @param request
   * @returns request object with requestTimeStamp value
   */
  function updateLifetimeFor(request) {
    request.requestTimeStamp = Math.floor((300 - (Date.now() - request.requestTimeStamp) / 1000));
    return request;
  }

  function validateStory(story) {
    // Max 500 bytes check
    if(Buffer.byteLength(story, 'utf8') > 500) return false;

    // Max 250 words check
    if(story.split(" ").length > 250) return false;

    return true;
  }

  /**
   * Endpoint: request validation
   * Method: Post
   * Accepts: JSON object {address: string}
   * Response: JSON object {address: address, requestTimeStampe: timestamp, message: string, validationWindow: int remaining validation time}
   */
  app.post('/requestValidation', async function (req, res) {
    if (typeof req.body.address !== 'string') {
      res.status(400).send({ error: 'Request requires an address key populated with string data in JSON format' });
    }

    const timestamp = Date.now();
    let response = {
      "address": req.body.address,
      "requestTimeStamp": timestamp,
      "message": `${req.body.address}:${timestamp}:starRegistry`,
    };
    await requestDb.addLevelDBData(req.body.address, response);
    response = updateLifetimeFor(response);
    res.send(response);
  });


  /**
   * Endpoint: validate message
   * Method: Post
   * Accepts: JSON object {address: string, signature:string}
   * Response: JSON object {}
   */
  app.post('/message-signature/validate', async function (req, res) {
    if (typeof req.body.address !== 'string' || typeof req.body.signature !== 'string') {
      res.status(400).send({error: 'Request requires an address key populated with string data in JSON format'});
    }

    // Validate request address and lifetime
    const storedRequest = await requestDb.getLevelDBData(req.body.address);

    if (!storedRequest) {
      res.status(404).send({error: 'Request address does not exist.'});
    }

    if ((Date.now() - storedRequest.requestTimeStamp) > (300 * 1000)) {
      res.status(400).send({error: 'Request expired.'})
    }

    const validatedRequest = await validateMessage(storedRequest, req.body.signature);
    if (!validatedRequest) {
      res.status(400).send({error: 'Invalid request signature.'})
    }

    const response = {
      "registerStar": true,
      "status": {...validatedRequest}
    }
    res.send(response);
  });

  app.post('/block', async function (req, res) {
    if (
      typeof req.body.address !== 'string' ||
      !req.body.star ||
      typeof req.body.star.dec !== 'string' ||
      typeof req.body.star.ra !== 'string' ||
      typeof req.body.star.story !== 'string'
    ) {
      res.status(400).send({error: 'Request requires an address key and a star object containing dec, ra and story properties'});
    }

    const storedRequest = await requestDb.getLevelDBData(req.body.address);

    if (!storedRequest) {
      res.status(404).send({error: 'Request address does not exist.'});
    }

    if ((Date.now() - storedRequest.requestTimeStamp) > (300 * 1000)) {
      res.status(400).send({error: 'Request expired.'})
    }

    if (!storedRequest.messageSignature || storedRequest.messageSignature !== 'valid') {
      res.status(400).send({error: 'You must verify the message before adding a star.'})
    }

    // Todo: Check on 250 words / 500 bytes per story
    if (!validateStory(req.body.star.story)) {
      res.status(400).send({error: 'Stories are limited to 500 bytes and 250 words.'})
    }

    if (req.body.star.mag && typeof req.body.star.mag !== 'string') {
      res.status(400).send({error: 'Optional value magnitude must be of type string.'})
    }

    if (req.body.star.cen && typeof req.body.star.cen !== 'string') {
      res.status(400).send({error: 'Optional value centaurus must be of type string.'})
    }

    req.body.star.story = new Buffer.from(req.body.star.story, 'utf8').toString('hex');
    const newStar = new Block(
      {
        "address": req.body.address,
        "star": req.body.star
      }
    );

    const newBlockHeight = await bc.addBlock(newStar);
    const response = await bc.getBlock(newBlockHeight);
    res.send(response);
  });

/*
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
*/
  app.listen(8000, () => console.log('App listening on port 8000!'))
}

start();
