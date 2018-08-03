# Blockchain Data Project

## Initializing

The project uses yarn. Run npm `npm install`or `yarn install` to get dependencies up and running. A node environment is required.

## Dependencies

- Express Framework

## Using the web API

To test the webservice simple start it with Node:

```
node server.js
```

Now these endpoints are available:

```
// Get block
GET http://0.0.0.0:8000/block/:id

// Add block
POST http://0.0.0.0:8000/block
```

### Adding new blocks

To add new blocks, the body of the POST needs to adhere to the following structure in JSON fromat:

```
{
    "body": "string"
}
```