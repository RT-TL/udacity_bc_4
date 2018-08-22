const express = require('express');
const bodyParser = require('body-parser');
const bitcoinMessage = require('bitcoinjs-message');
const {Block, Blockchain} = require('./dbchain');
const db = require('./database');

async function start() {
  const bc = new Blockchain();
  const requestDb = new db('requests');
  await bc.init();
  const app = express();
  const VALIDATION_WINDOW = 300;
  // Parsing application/json data inputs
  app.use(bodyParser.json({type: 'application/json'}));




  /** INTERNAL FUNCTIONS **/

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
   * Calculates the left over seconds of the validation window based on current time.
   *
   * @param timestamp
   * @returns int seconds remaining time or null if negative
   */
  function remainingWindowInSeconds(timestamp) {
    if(typeof timestamp !== 'number') {
      throw {
        name: "InternalError",
        message: `Timestamp expected to be number. Received '${timestamp}'.`,
        toString: function () {
          return this.name + ": " + this.message;
        }
      };
    }

    let remaining = ((timestamp + (VALIDATION_WINDOW * 1000)) - Date.now());
    remaining = Math.floor(remaining / 1000);
    if (remaining > 0) return remaining;
    else return null;
  }


  /**
   * Injects remaining lifetime for request
   *
   * @param request
   * @returns request object with requestTimeStamp value
   */
  function updateLifetimeFor(request) {
    request.validationWindow = Math.floor((300 - (Date.now() - request.requestTimeStamp) / 1000));
    return request;
  }


  /**
   * Mutates star object adding decoded story value based on contained story value
   * @param starObject
   */
  function decodeStory(starObject) {
    return starObject.storyDecoded = Buffer.from(starObject.story, 'hex').toString('utf8');
  }


  /**
   * Validates the story parameter
   * @param story
   * @returns {boolean}
   */
  function validateStory(story) {
    // Max 500 bytes check
    if(Buffer.byteLength(story, 'utf8') > 500) return false;

    // Max 250 words check
    if(story.split(" ").length > 250) return false;

    return true;
  }


  /** PUBLIC ENDPOINTS **/

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

    // If a still valid request already exists, return this request instead of overwriting it.
    const existingRequest = await requestDb.getLevelDBData(req.body.address);
    if (existingRequest !== null && remainingWindowInSeconds(existingRequest.requestTimeStamp)) {
      existingRequest.validationWindow = remainingWindowInSeconds(existingRequest.requestTimeStamp);
      return res.send(existingRequest);
    }

    // If no current valid request: Create new one
    await requestDb.addLevelDBData(req.body.address, response);
    response.validationWindow = remainingWindowInSeconds(response.requestTimeStamp);
    res.send(response);
  });


  /**
   * Endpoint: validate message
   * Method: POST
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
      "status": {...validatedRequest},
    };

    res.send(response);
  });

  /**
   * Endpoint block
   * Method: POST
   * Accepts: JSON object containing
   * string address
   * star object with dec, ra, story values (requried) and mag/cen values (optional)
   * Does store other values in star object but without any meaning or validation.
   */
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

    // Input data validation
    if (!storedRequest) {
      res.status(404).send({error: 'Request address does not exist.'});
    }
    if ((Date.now() - storedRequest.requestTimeStamp) > (300 * 1000)) {
      res.status(400).send({error: 'Request expired.'})
    }
    if (!storedRequest.messageSignature || storedRequest.messageSignature !== 'valid') {
      res.status(400).send({error: 'You must verify the message before adding a star.'})
    }
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

    // Invalidate request
    storedRequest.messageSignature = 'invalid';
    requestDb.addLevelDBData(req.body.address, storedRequest);

    // Add new star
    const newBlockHeight = await bc.addBlock(newStar);
    const response = await bc.getBlock(newBlockHeight);
    res.send(response);
  });


  /**
   * Endpoint block/:height
   * Method: GET
   * Accepts: height integer.
   * Returns: {block} with decoded story, 404 error
   */
  app.get('/block/:height', async function (req, res) {
    const response = await bc.getBlock(req.params.height);
    if (!response) {
      res.status(404).send({error: `Block #${req.params.height} does not exist.`});
    }
    if (response.body.star && response.body.star.story) {
      decodeStory(response.body.star);
    }
    res.send(response);
  });


  /**
   * Endpoint block/:hash
   * Method: GET
   * Accepts: hash string.
   * Returns: {block} with decoded story, 404 error
   */
  app.get('/stars/hash::hash', async function (req, res) {
    const response = await bc.findBlocksBy('hash', req.params.hash, false);

    if (response.length === 0) {
      res.status(404).send({error: `Block with hash ${req.params.hash} does not exist.`})
    }

    // Add story to block if there is a story (which is not in case of genesis block)
    response.map(block => {
      if(block.body.star) decodeStory(block.body.star);
    });
    res.send(response[0]);
  });


  /**
   * Endpoint stars/address::address
   * Method: GET
   * Accepts: address string.
   * Returns: {block} with decoded story, 404 error
   */
  app.get('/stars/address::address', async function (req, res) {
    const response = await bc.findBlocksBy('address', req.params.address, true);
    response.map(block => { decodeStory(block.body.star) });
    res.send(response);
  });

  app.listen(8000, () => console.log('App listening on port 8000!'))
}

start();
