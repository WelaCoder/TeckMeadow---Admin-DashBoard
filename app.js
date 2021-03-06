var express = require("express");
const path = require("path");
var app = express();
var http = require("http").createServer(app);
var io = require("socket.io")(http);
const bodyParser = require("body-parser");
const User = require("./models/user");
const auth = require("./middleware/auth");
var methodOverride = require("method-override");
var userRoutes = require("./routes/users");
var adminRoutes = require("./routes/adminRoutes");
var projectRoutes = require("./routes/projectRoutes");
var commentRoutes = require("./routes/commentRoutes");
var authRoutes = require("./routes/auth");
var fileRoutes = require("./routes/fileRoutes");
var notificationRoutes = require("./routes/notificationRoutes");
var Message = require("./models/message");
var Notification = require("./models/notification");
var users = [];
const port = process.env.PORT || 5000;
// mongoose.connect(
//   "mongodb+srv://wela:wela@cluster0-d3lhq.mongodb.net/test?retryWrites=true&w=majority",
//   {
//     useNewUrlParser: true,
//     useCreateIndex: true,
//     useUnifiedTopology: true
//   }
// );
// Connect Database
require("./config/db")();
app.use(
  bodyParser.urlencoded({
    extended: true,
  })
);
app.use(bodyParser.json()); // for parsing application/x-www-form-urlencoded
app.use(express.static("public"));
app.get("/api/employees", auth.isAdmin, (req, res) => {
  User.find({ isAdmin: false })
    .populate("messages")
    .populate("projects")
    .exec(function (err, employees) {
      if (err) {
        console.log(err);
        res.status(400).json({ message: "No employees found" });
      } else {
        res.json({ employees });
      }
    });
});
// app.get("/uploads/:id", (req, res) => {
//   res.sendFile("/uploads/" + req.params.id);
// });

app.use(require("express").static("public"));
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/projects", projectRoutes);
app.use("/api/comments/", commentRoutes);
app.use("/api/files", fileRoutes);
app.use("/api/notifications", notificationRoutes);
io.on("connection", function (socket) {
  socket.on("new-user", (data) => {
    socket.userId = data.userId;
    User.findById(data.userId, function (err, user) {
      if (err) {
        console.log(err);
      } else {
        console.log(data);
        user.isOnline = true;
        user.save();
      }
    });
    users[data.name] = { socket: socket.id };
  });
  socket.on("message", async (data) => {
    try {
      let message = await Message.create({
        sender: data.sender,
        reciever: data.reciever,
        message: data.message,
      });
      let user = await User.findById(data.id);
      console.log(data);
      user.messages.push(message);
      await user.save();
      if (users[data.reciever]) {
        if (io.sockets.connected[users[data.reciever].socket]) {
          console.log(data);

          io.sockets.connected[users[data.reciever].socket].emit(
            "message",
            data
          );
        } else {
          if (data.reciever == "admin") {
            user.count = user.count + 1;
            console.log(user);
            await user.save();
            console.log("added count");
            let notification = await Notification.create({
              category: "message",
              owner: "admin",
              description: "You have a new message, Click to open messenger",
              message: data,
            });
            user.notifications.push(notification);
          } else {
            let notification = await Notification.create({
              category: "message",
              owner: user._id,
              description: "You have a new messages from Teckmeadow",
              message: data,
            });
            user.notifications.push(notification);
            user.haveUnreadMessages = true;
            await user.save();
          }
        }
      } else {
        if (data.reciever == "admin") {
          user.count = user.count + 1;
          console.log(user);
          await user.save();
          console.log("added count");
        }
      }
    } catch (error) {
      console.log(error);
    }
    // store in database and then parse if online
    // Message.create(
    //   {
    //     sender: data.sender,
    //     reciever: data.reciever,
    //     message: data.message,
    //   },
    //   function (err, message) {
    //     if (err) {
    //       console.log(err);
    //     } else {
    //       User.findById(data.id, function (err, user) {
    //         if (err) {
    //           console.log(err);
    //         } else {
    //           user.messages.push(message);
    //           user.save();
    //         }
    //       });
    //     }
    //   }
    // );
    // console.log(data);
    // if (users[data.reciever]) {
    //   if (io.sockets.connected[users[data.reciever].socket]) {
    //     console.log(data);

    //     io.sockets.connected[users[data.reciever].socket].emit("message", data);
    //   }
    // }
  });
  socket.on("disconnect", function () {
    User.findById(socket.userId, function (err, user) {
      if (err) {
        console.log(err);
      } else {
        if (user) {
          user.isOnline = false;

          user.save();
        }
      }
    });
  });
});

const root = require("path").join(__dirname, "client", "build");
app.use(express.static(root));
app.get("*", (req, res) => {
  res.sendFile("index.html", { root });
});

// render react app page
// app.get("*", (req, res) => {
//   res.sendFile(path.resolve(__dirname, "client", "build", "index.html"));
// });

http.listen(port, function () {
  console.log("listening on *:5000");
});
