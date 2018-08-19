# Blockchain Data Project

## Initializing

The project uses yarn. Run npm `npm install`or `yarn install` to get dependencies up and running. A node environment is required.

## Dependencies

- Express Framework
- LevelDB
- Bitcoinjs-message
- Node

## Using the web API

To test the webservice simple start it with Node:

```
node server.js
```

Now these endpoints are available:

```
POST http://0.0.0.0:8000/requestValidation
POST http://0.0.0.0:8000/message-signature/validate
POST http://0.0.0.0:8000/block
GET http://0.0.0.0:8000//block/:height
GET http://0.0.0.0:8000/stars/address::address
GET http://0.0.0.0:8000/stars/:hash
```

### Creation of blocks

To create a block, the process requires three steps. First request validation. Within 5 minutes you can now submit your signed message. After verification that your message was signed correctly you can post a new block by submitting a star object:

```
// Post request validation
POST http://0.0.0.0:8000/requestValidation
{
	"address": "YOUR_BITCOIN_ADDRESS",
}

POST http://0.0.0.0:8000/message-signature/validate
{
	"address": "YOUR_BITCOIN_ADDRESS",
	"signature": "YOUR_SIGNED_MESSAGE"
}

POST http://0.0.0.0:8000/block
{
  "address": "YOUR_BITCOIN_ADDRESS",
  "star": {
    "dec": "DEC_VALUE",
    "ra": "RA_VALUE",
    "story": "STORY_VALUE" // max. 250 characters, 500 bytes,
    "cen": "CENTAURUS", // optional
    "mag": "MAGNITUED", // optional
  }
}

```

### Finding existing blocks

There are three ways to find a block or a series of blocks. To get the data of a single block use either

```
GET http://0.0.0.0:8000/stars/hash:STRING_HASH
```

or:

```
GET http://0.0.0.0:8000/blocks/INT_BLOCK_HEIGHT

```

Both will return a single block with storyDecoded value:

```
{
    "hash": "HASH",
    "height": INT,
    "body": {
        "address": "ADDRESS",
        "star": {
            "dec": "DEC",
            "ra": "RA",
            "story": "STORY_HASH",
            "storyDecoded": "STORY"
        }
    },
    "time": "TIMESTAMP",
    "previousBlockHash": "HASH"
}
```

To fetch all blocks/stars related to a bitcoin address use:

```
GET http://0.0.0.0:8000/stars/address:ADDRESS
```

You will receive back an array of blocks with the provided address or en ampty rray if none were found.