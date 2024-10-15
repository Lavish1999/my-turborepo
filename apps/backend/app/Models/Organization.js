'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Organization extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      this.myAssociation=models.Organization.hasMany(models.OrganizationMember, { as:'OrganizationMembers', foreignKey: "organization_id"});
      this.myAssociation=models.Organization.hasMany(models.Project, { as:'OrganizationProjects', foreignKey: "organization_id"});
      this.myAssociation=models.Organization.belongsTo(models.User, { as: 'user', foreignKey: "created_by"});
    }
  };
  Organization.init({
    name        : DataTypes.STRING,
    openai_key  : DataTypes.STRING,
    created_by  : DataTypes.INTEGER,
  }, {
    sequelize,
      modelName: 'Organization',
      timestamps: { createdAt: 'created_at', updatedAt: 'updated_at', deletedAt: 'deleted_at' },
      underscored: true,
      paranoid: true

  });
  return Organization;
};