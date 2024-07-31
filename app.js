const express = require('express');
const app = express();
const path = require('path');
const session = require('express-session');
const indexRouter = require('./routes/index');
const adminRouter = require('./routes/admin');

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: false }));

app.use(session({
  secret: 'your_secret_key',
  resave: false,
  saveUninitialized: true
}));

app.use((req, res, next) => {
  res.locals.cartItems = req.session.cart || [];
  res.locals.user = req.session.user;
  next();
});


app.use('/', indexRouter);
app.use('/admin', adminRouter);

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
