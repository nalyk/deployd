<!--{
  title: 'Installing Deployd',
  tags: ['install']
}-->

## Installing Deployd

### Requirements

- **Node.js 22.x LTS or newer** - [Download Node.js](https://nodejs.org/en/download/)
  - This fork requires Node.js 22+ for modern JavaScript features and TLS compatibility
- **MongoDB 6.0 or newer** - [Download MongoDB](https://www.mongodb.com/try/download/community)
  - Compatible with MongoDB Atlas and other managed MongoDB services
  - Supports MongoDB 6.x and 7.x with modern driver features

**Note**: This modernized fork includes TLS 1.0+ compatibility for managed MongoDB services like MongoDB Atlas, Azure Cosmos DB, and AWS DocumentDB.

### Install from NPM (recommended way)

You can install Deployd as a **node module** using `npm`. Just run the following:

    npm install deployd -g
    
The `dpd` program should be available. Try `dpd -V`.

### From Source

You can download the latest source on [github](http://github.com/deployd/deployd).

    git clone https://github.com/deployd/deployd.git
    npm install
    npm link

### Mac / Windows

The macosx installer has been deprecated, please, use the npm install.

