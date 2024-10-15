"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class SessionLead extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      this.myAssociation=models.SessionLead.belongsTo(models.WidgetFormField, { as: 'widget_form_field', foreignKey: "field_id"});
    }
  }
  SessionLead.init(
    {
        session_id : DataTypes.INTEGER,
        field_id   : DataTypes.INTEGER,
        value      : DataTypes.STRING
    },
    {
      sequelize,
      modelName: "SessionLead",
      timestamps: false,
      underscored: true,
    }
  );
  return SessionLead;
};