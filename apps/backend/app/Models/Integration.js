'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Integration extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      this.myAssociation=models.Integration.hasMany(models.ProjectIntegration, { as:'projectIntegration', foreignKey: "id"});
    }
  };
  Integration.init({
    name        : DataTypes.STRING,
    message     : DataTypes.STRING,
    images      : DataTypes.STRING,
    description : DataTypes.STRING,
    public_key  : DataTypes.STRING,
    secret_key  : DataTypes.STRING,
  }, {
    sequelize,
      modelName: 'Integration',
      timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
      underscored: true,

  });
  return Integration;
};