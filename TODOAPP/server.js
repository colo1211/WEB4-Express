const express = require('express');
const app = express();
const MongoClient = require('mongodb').MongoClient;
app.set('view engine', 'ejs');
app.use('/public', express.static('public')); 

var db; // db 를 담을 변수
MongoClient.connect(
  'mongodb+srv://admin:1234@cluster0.skcs6.mongodb.net/myFirstDatabase?retryWrites=true&w=majority',
  function (err, client) {
    if (err) {
      return console.log(err);
    }

    db = client.db('todoapp'); // todoapp 이라는 db (폴더)에 연결
    // db.collection('post').insertOne({이름:'john', 나이:20, _id:1}, function(에러, 결과){
    //     console.log('저장완료');
    // });

    app.listen(8080, function () {
      console.log('8080 가동 중');
    });
  }
);

app.use(express.urlencoded({ extended: true }));

app.get('/', function (req, res) {
  // res.sendFile(__dirname + '/index.html');
  res.render('index.ejs'); 
});

app.get('/write', function (req, res) {
  // res.sendFile(__dirname + '/write.html'); 
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
        })
      }
    );
  })
  
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

