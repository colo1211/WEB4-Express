const express = require('express');
const app = express();
const MongoClient = require('mongodb').MongoClient;
app.set('view engine', 'ejs');
app.use('/public', express.static('public')); 
const methodOverride = require('method-override');
app.use(methodOverride('_method'));
require('dotenv').config();

var db; // db 를 담을 변수
MongoClient.connect(
  process.env.DB_URL,
  function (err, client) {
    if (err) {
      return console.log(err);
    }

    db = client.db('todoapp'); // todoapp 이라는 db (폴더)에 연결
    // db.collection('post').insertOne({이름:'john', 나이:20, _id:1}, function(에러, 결과){
    //     console.log('저장완료');
    // });

    app.listen(process.env.PORT, function () {
      console.log('8080 가동 중');
    });
  }
);

app.use(express.urlencoded({ extended: true }));

const passport = require('passport'); 
const LocalStrategy = require('passport-local').Strategy; // 로컬전략
const session = require('express-session'); 

// 미들웨어
app.use(session({secret:'비밀코드', resave : true, saveUninitialized : false})); 
app.use(passport.initialize());
app.use(passport.session()); 

app.get('/login', function(req,res){
  res.render('login.ejs'); 
})

// 폼데이터로 로그인 정보를 보내면, 미들웨어(passport.authenticate('local',{}))로 검사
// 맞다면 '/' 으로 리다이렉트
// 틀리다면 '/fail' 로 리다이렉트
app.post('/login', passport.authenticate('local',{
  failureRedirect : '/fail',
  successRedirect : '/',
}));


// 미들웨어
function checkLogin(req, res, next){
  console.log('checkLogIn', req.user); 
  // req.user는 로그인 후, 세션이 있으면 항상 req.user가 존재한다.
  if(req.user){
    console.log('로그인O'); 
    next(); // 다음으로 통과
  }else{
    console.log('로그인X'); 
    res.redirect('/login'); 
  }
}

// passport의 미들웨어, id와 pw를 받아서 db에 조회하는 역할
passport.use(new LocalStrategy({
  usernameField: 'id', // 폼데이터에서 입력한 id 
  passwordField: 'pw', // 폼데이터에서 입력한 pw
  session: true, // 세션아이디를 만들어서 저장 여부 
  passReqToCallback: false, // id, pw 이외의 다른 정보가 존재하는지? -> 만약 존재한다면, 콜백함수의 첫 인자로 객체형태(req)로 받을 수 있음
}, function (id, pw, done) {
  console.log('passport에서 id/pw 조회',id, pw); // 유저가 입력한 id와 pw 정보
  // login 콜렉션에 id 정보가 존재하는지 조회
  db.collection('login').findOne({ id: id }, function (err, result) {
    if (err) return done(err)
    // id를 조회해서 result 가 없으면
    if (!result) return done(null, false, { message: '존재하지않는 아이디' })
    // result 가 있으면
    if (pw == result.pw) {
      return done(null, result) // 여기서 result 는 serializeUser의 user 값으로 전달
    } else {
      return done(null, false, { message: '비번틀림' })
    }
  })
}));

// serializeUser 
// 로그인 했을 때, 최초로 한번 호출되는 함수
// 세션아이디를 쿠키에 자동으로 저장하는 함수
passport.serializeUser(function(user, done){
  console.log('serializeUser 들어옴', user.id);
  done(null,user.id); // serializeUser에서 done(null, user.id)를 호출하면, 세션에 id 값이 저장
})

// deserializeUser 
// 로그인에 성공하고, 페이지를 방문할 때마다 호출
//  deserializeUser가 호출되면 request.user 라는 객체가 생성되므로 유저에 대한 정보를 손쉽게 사용할 수 있음
passport.deserializeUser(function(아이디,done){
  console.log('deserializeUser 들어옴',아이디);
  db.collection('login').findOne({ id : 아이디}, function(err,result){
    console.log(result); 
    done(null, result);
  })
})

app.get('/', function (req, res) {
  // res.sendFile(__dirname + '/index.html');
  res.render('index.ejs'); 
});

app.get('/write', checkLogin, function (req, res) {
  res.render('write.ejs'); 
});

// 글을 생성하려면 -> id 를 unique 하게 부여하기 위해서
// 1. 게시물의 id 를 부여하기 위해서 counter collection 의 totalPost에 접근하여 값을 가져온다.
// 2. db.collection().insertOne({_id : totalPost + 1}, function(){ // 내부에 totalPost를 1증가} )
// 3. Counter 라는 collection에 있는 totalPost 라는 항목도 1 증가시켜야 한다.   
app.post('/add', function (req, res) {
  // 1. 
  db.collection('counter').findOne({name : '게시물갯수'}, function(err, result){
    
    console.log(result.totalPost); 
    
    // 2. 
    db.collection('post').insertOne(
      { _id : result.totalPost + 1, 제목: req.body.title, 날짜: req.body.date },
      (err, result) => {
        console.log('db 저장 완료');

        // 3. updateOne({이런 데이터를}, {이런 값으로 수정}) , 콜백함수
        // operator : 
        // {$set : {totalPost : 바꿀 값}}
        // {$inc : {totalPost : 기존에 더해줄 값}}
        db.collection('counter').updateOne({name : '게시물갯수'},{ $inc : {totalPost : 1}}, function(err, result ){
          if(err) {
            return err; 
          }
          res.redirect('/list');
        })
      }
    );
  });
});

app.get('/list', function (req, res) {
  db.collection('post').find().toArray(function (err, result) {
      console.log(result);
      res.render('list.ejs', { posts: result });
    }); // 모든 데이터들을 가져온다.
});

app.delete('/delete', function(req,res){
  console.log('ajax',req.body);
  db.collection('post').deleteOne({_id : parseInt(req.body._id)}, function(err,result){
    if(err){
      res.send(400).send({message : '삭제 실패했습니다.'}); 
    }
    res.status(200).send({message : '삭제 성공했습니다.'});
  })
}); 

// 상세 페이지 : req.params.id
app.get('/detail/:id', function(req,res){
  req.params.id = parseInt(req.params.id); 
  db.collection('post').findOne({ _id : req.params.id }, function(err, result){
    if(!result){
      res.status(400).send({message: '요청한 페이지가 존재하지 않습니다.' , err}); 
    }
    res.render('detail.ejs', {data : result});
  })   
})

app.get('/edit/:id', function(req,res){
  var id = parseInt(req.params.id);
  db.collection('post').findOne({ _id : id}, function(err, result){
    if(!result){
      res.status(400).send({message:'해당 페이지는 DB 상에 존재하지 않습니다.'}); 
    }
    console.log(result); 
    res.render('edit.ejs', {data : result}); 
  });
})

app.put('/edit', function(req,res){
  var id = parseInt(req.body.id); 
  db.collection('post').updateOne({ _id : id }, {$set : {제목 : req.body.title, 날짜 : req.body.date}}, function(err, result){
    if(!result){
      res.status(400).send({message: '수정에 실패하였습니다.'});
    }
    res.redirect(`/detail/${req.body.id}`)
  })
});

app.get('/mypage', checkLogin, function(req,res){
  console.log(req.user); 
  res.render('mypage.ejs', {data : req.user}); 
});

app.get('/search', function(req, res){
  // req.query 로 검색 query 를 설정 
  console.log('검색 데이터', req.query.value);
  db.collection('post').find({제목 : req.query.value}).toArray(function(err, result){
    res.render('search.ejs', {posts : result})
  })
})