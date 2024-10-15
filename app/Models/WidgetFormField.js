"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class WidgetFormField extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  WidgetFormField.init(
    {
        name             : DataTypes.STRING,
        widget_id        : DataTypes.INTEGER,
        type             : DataTypes.ENUM('country', 'name','text', 'email', 'phone', 'textarea', 'checkbox', 'radio', 'select', 'number', 'date_picker', 'dropdown_multiple'),
        options          : DataTypes.STRING,
        required         : DataTypes.INTEGER,
        validation_rules : DataTypes.STRING,
        priority         : DataTypes.INTEGER,
        deleted_at: DataTypes.TIME,
    },
    {
      sequelize,
      modelName: "WidgetFormField",
      timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
      underscored: true,
      paranoid: true
    }
  );
  return WidgetFormField;
};