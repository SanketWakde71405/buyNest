import app from "./app.js";
import mongoose from "mongoose";
import connectDB from "./db/index.js";


const port = process.env.PORT || 8000;

connectDB().then(() => {
  app.listen(port, () => {
    console.log(`⚙️ Server is running at port : ${port}`);
    console.log("Database is connected successfully ✅✅");
  });
});
