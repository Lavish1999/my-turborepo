module.exports = {
  development: {
    mysql:{ 
      host: env("MYSQL_HOSTNAME", "localhost"),
      database: env("MYSQL_DATABASE", ""),
      username: env("MYSQL_USERNAME", ""),
      password: env("MYSQL_PASSWORD", ""),
      port: env("MYSQL_PORT", "3306"),
      dialect: 'mysql',
      dialectOptions: {
        bigNumberStrings: true
      }
    },
    mongodb:{
      "url": env("MONGODB_DATABASE_URI", ""),
      "options": {
        "dbName": env("MONGODB_DATABASE", "")
      }
    }
  },
  test: {
    mysql:{ 
      host: env("MYSQL_HOSTNAME", "localhost"),
      database: env("MYSQL_DATABASE", ""),
      username: env("MYSQL_USERNAME", ""),
      password: env("MYSQL_PASSWORD", ""),
      port: env("MYSQL_PORT", "3306"),
      dialect: 'mysql',
      dialectOptions: {
        bigNumberStrings: true
      }
    },
    mongodb:{
      "url": env("MONGODB_DATABASE_URI", ""),
      "options": {
        "dbName": env("MONGODB_DATABASE", "")
      }
    }
  },
  production: {
    mysql:{
      host: env("MYSQL_HOSTNAME", "localhost"),
      database: env("MYSQL_DATABASE", ""),
      username: env("MYSQL_USERNAME", ""),
      password: env("MYSQL_PASSWORD", ""),
      port: env("MYSQL_PORT", "3306"),
      dialect: 'mysql',
      dialectOptions: {
        bigNumberStrings: true
      }
    },
    mongodb:{
      "url": env("MONGODB_DATABASE_URI", ""),
      "options": {
        "dbName": env("MONGODB_DATABASE", "")
      }
    }
  }
};

