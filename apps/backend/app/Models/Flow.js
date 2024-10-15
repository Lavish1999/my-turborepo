"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class Flow extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  Flow.init(
    {
      project_id: DataTypes.INTEGER,
      version: DataTypes.STRING,
      data: {
        type: DataTypes.TEXT,
        get() {
          // Parse the stored JSON data when retrieving it
          const jsonData = this.getDataValue('data');
          return jsonData ? JSON.parse(jsonData) : null;
        },
        set(value) {
          // Stringify the JSON data when setting it
          this.setDataValue('data', JSON.stringify(value));
        },
      },
      status: DataTypes.ENUM('draft', 'published'),
    },
    {
      sequelize,
      modelName: "Flow",
      timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
      underscored: true,
    }
  );
  return Flow;
};