const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log(`MongoDB Conectado a la base de datos: ${conn.connection.name}`);
  } catch (error) {
    console.error(`Error conectando a MongoDB: ${error.message}`);
    process.exit(1); 
  }
};

module.exports = connectDB;