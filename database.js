const level = require('level');

class Database {
  constructor(path) {
    const chainDB = path;
    this.db = level(chainDB, { valueEncoding: 'json' });
  }

  /**
   * Checks if any records are currently stored in levelDB
   * @returns {Promise<bool, Error>} A promise that returns a boolean if resolved,
   *     or an Error if rejected.
   */
  isEmpty() {
    return new Promise( (resolve, reject) => {
      let empty = true;
      this.db.createReadStream({
        keys: true,
        values: false,
        limit: 1
      })
        .on('data', function () {
        empty = false;
      })
        .on('error', function (error) {
        reject(error);
      })
        .on('close', function () {
        resolve(empty);
      });
    });
  }

  /**
   *
   * @returns {Promise<int, Error>} Promise resolves to length integer
   */
  async getLength() {
    return new Promise( (resolve, reject) => {
      let length = 0;
      this.db.createReadStream({
        keys: true,
        values: false
      }).on('data', function () {
        length += 1;
      })
        .on('error', function (error) {
        reject(error);
      })
        .on('close', function () {
        resolve(length);
      });
    });
  }

  /**
   * Usually expects JSON objects to be added to the database.
   *
   * @param key
   * @param value
   * @returns {Promise<boolean>}
   */
  async addLevelDBData(key,value){
    await this.db.put(key, value).catch(error => {
      console.log(error);
      return false;
    });

    return true;
  }

  /**
   *
   * @param key
   * @returns {Promise<object, Error>} Resolves to JSON object or null if object is not in the database
   */
  async getLevelDBData(key){
    return await this.db.get(key).catch(error => {
      console.log(error);
      return null;
    });
  }

  /**
   * console logs all database records
   * @returns void
   */
  // Todo: toJson
  printAll() {
    this.db.createReadStream().on('data', function(data) {
      console.log(JSON.stringify(data));
    })
      .on('error', function(error) {
        console.log(error);
    });
  }
}

module.exports = Database;