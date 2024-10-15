'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class SourceNode extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  };
  SourceNode.init({
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false
    },
    query_message_id: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    reply_message_id: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    query_message: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    source_doc_id: {
      type: DataTypes.STRING(45),
      allowNull: true
    },
    doc_text: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: sequelize.literal('CURRENT_TIMESTAMP')
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: sequelize.literal('CURRENT_TIMESTAMP'),
      onUpdate: sequelize.literal('CURRENT_TIMESTAMP')
    }
  }, {
    sequelize,
    modelName: 'SourceNode',
    timestamps: true, // Since you have created_at and updated_at
    underscored: true
  });
  return SourceNode;
};
