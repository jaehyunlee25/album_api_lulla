/* eslint-disable no-lonely-if */
import {
  RESPOND,
  ERROR,
  getUserIdFromToken,
  POST,
} from '../../../lib/apiCommon';
import setBaseURL from '../../../lib/pgConn'; // include String.prototype.fQuery

const QTS = {
  // Query TemplateS
  getAllComments: 'getAllComments',
  getAllLikes: 'getAllLikes',
  // grade one
  getOne: 'getOne',
  getOneTotal: 'getTotal',
  // grade one search
  getOneSearchNone: 'getOneSearchNone',
  getOneTotalSearchNone: 'getOneTotalSearchNone',

  getOneSearchContents: 'getOneSearchContents',
  getOneTotalSearchContents: 'getOneTotalSearchContents',

  getOneSearchAuthor: 'getOneSearchAuthor',
  getOneTotalSearchAuthor: 'getOneTotalSearchAuthor',

  getOneSearchBoth: 'getOneSearchBoth',
  getOneTotalSearchBoth: 'getOneTotalSearchBoth',
  // grade one temp
  getOneTemp: 'getOneTemp',
  getOneTotalTemp: 'getOneTotalTemp',
  // grade one else
  getOneElse: 'getOneElse',
  getOneTotalElse: 'getOneTotalElse',

  // grade two search
  getTwoSearchNone: 'getTwoSearchNone',
  getTwoTotalSearchNone: 'getTwoTotalSearchNone',

  getTwoSearchContents: 'getTwoSearchContents',
  getTwoTotalSearchContents: 'getTwoTotalSearchContents',

  getTwoSearchAuthor: 'getTwoSearchAuthor',
  getTwoTotalSearchAuthor: 'getTwoTotalSearchAuthor',

  getTwoSearchBoth: 'getTwoSearchBoth',
  getTwoTotalSearchBoth: 'getTwoTotalSearchBoth',
  // grade two temp
  getTwoTemp: 'getTwoTemp',
  getTwoTotalTemp: 'getTwoTotalTemp',
  // grade two else
  getTwoElse: 'getTwoElse',
  getTwoTotalElse: 'getTwoTotalElse',

  // grade else search
  getElseSearchNone: 'getElseSearchNone',
  getElseTotalSearchNone: 'getElseTotalSearchNone',

  getElseSearchContents: 'getElseSearchContents',
  getElseTotalSearchContents: 'getElseTotalSearchContents',

  getElseSearchAuthor: 'getElseSearchAuthor',
  getElseTotalSearchAuthor: 'getElseTotalSearchAuthor',

  getElseSearchBoth: 'getElseSearchBoth',
  getElseTotalSearchBoth: 'getElseTotalSearchBoth',
  // grade else else
  getElseElse: 'getElseElse',
  getElseTotalElse: 'getElseTotalElse',
  //
  getPostGrade: 'getPostGrade',
  getCountClass: 'getCountClass',
  getAlbumData: 'getAlbumData',
};

// req.body를 만들지 않도록 한다.
// export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  // #1. cors 해제
  res.writeHead(200, {
    'Access-Control-Allow-Origin': '*', // for same origin policy
    'Content-Type': 'application/json',
    'Access-Control-Allow-Headers': ['Content-Type', 'Authorization'], // for application/json
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  });
  // #2. preflight 처리
  if (req.method === 'OPTIONS') return RESPOND(res, {});

  setBaseURL('sqls/album/list'); // 끝에 슬래시 붙이지 마시오.

  // #3.1.
  try {
    return await main(req, res);
  } catch (e) {
    return ERROR(res, {
      id: 'ERR.album.list.3.2.2',
      message: 'post server logic error',
      error: e.toString(),
    });
  }
}
async function main(req, res) {
  if (req.body.id) return detail(req, res);
  // #3.1. 사용자 토큰을 이용해 userId를 추출한다.
  // 이 getUserIdFromToken 함수는 user의 활성화 여부까지 판단한다.
  // userId가 정상적으로 리턴되면, 활성화된 사용자이다.
  const qUserId = await getUserIdFromToken(req.headers.authorization);
  if (qUserId.type === 'error') return qUserId.onError(res, '3.1');
  const userId = qUserId.message;

  const {
    member_id: memberId,
    class: classes,
    page: userPage,
    temp,
    category,
    search,
  } = req.body;

  const pageSize = 30;
  const page = pageSize * ((userPage === undefined ? 1 : userPage) - 1);
  const endDate = await getFormatDate(new Date());
  const isPublished = !temp;
  const strClasses = ["'", classes.join("','"), "'"].join('');

  // #3.2. member 검색
  const qMember = await POST(
    'school',
    '/checkMember',
    { 'Content-Type': 'application/json' },
    { userId, memberId },
  );
  if (qMember.type === 'error')
    return qMember.onError(res, '3.2', 'fatal error while searching member');
  const { schoolId, classId /* , grade, kidId */ } = qMember.message;

  // #3.8. memberId를 통해 포스트에 읽기 권한이 있는지 살펴본다.
  const action = 2;
  const qPG = await QTS.getPostGrade.fQuery({ memberId, action });
  if (qPG.type === 'error') return qPG.onError(res, '3.8.1', 'searching grade');
  console.log('===============', 6);
  if (qPG.message.rows.length === 0)
    return ERROR(res, {
      resultCode: 401,
      message: '공지에 대한 접근 권한이 없습니다.',
      id: 'ERR.post.index.3.8.2',
      data: { post: [], total_count: 0, total_page: 0 },
    });
  console.log('===============', 7);
  const { grade } = qPG.message.rows[0];

  const qCountClass = await QTS.getCountClass.fQuery({ schoolId });
  if (qCountClass.type === 'error')
    return qCountClass.onError(res, '3.8.1', 'searching likes');
  console.log('===============', 8);
  const { cntClass } = qCountClass.message.rows[0].count;

  let qPost;
  let qTotal;
  if (grade === 1) {
    if (classes.length > 0 && cntClass !== classes.length) {
      console.log('===============', 8.1);
      qPost = await QTS.getOne.fQuery({
        memberId,
        endDate,
        schoolId,
        classes: strClasses,
        isPublished,
        page,
        pageSize,
      });
      qTotal = await QTS.getOneTotal.fQuery({
        schoolId,
        classes: strClasses,
        memberId,
        isPublished,
      });
    } else if (search) {
      console.log('===============', 8.2);
      let qts;
      let qtsCnt;
      if (category.length === 0) {
        qts = QTS.getOneSearchNone;
        qtsCnt = QTS.getOneTotalSearchNone;
      }
      if (category.length === 1 && category[0] === 'contents') {
        qts = QTS.getOneSearchContents;
        qtsCnt = QTS.getOneTotalSearchContents;
      }
      if (category.length === 1 && category[0] === 'author') {
        qts = QTS.getOneSearchAuthor;
        qtsCnt = QTS.getOneTotalSearchAuthor;
      }
      if (category.length === 2) {
        qts = QTS.getOneSearchBoth;
        qtsCnt = QTS.getOneTotalSearchBoth;
      }

      qPost = await qts.fQuery({
        search,
        memberId,
        endDate,
        schoolId,
        isPublished,
        page,
        pageSize,
      });
      qTotal = await qtsCnt.fQuery({
        search,
        schoolId,
        isPublished,
      });
    } else if (temp) {
      console.log('===============', 8.3);
      qPost = await QTS.getOneTemp.fQuery({
        memberId,
        endDate,
        isPublished,
      });
      qTotal = await QTS.getOneTotalTemp.fQuery({
        memberId,
        isPublished,
      });
    } else {
      console.log('===============', 8.4);
      qPost = await QTS.getOneElse.fQuery({
        memberId,
        schoolId,
        endDate,
        isPublished,
        page,
        pageSize,
      });
      qTotal = await QTS.getOneTotalElse.fQuery({
        schoolId,
        isPublished,
      });
    }
  } else if (grade === 2) {
    console.log('===============', 8.5);
    if (search) {
      let qts;
      let qtsCnt;
      if (category.length === 0) {
        qts = QTS.getTwoSearchNone;
        qtsCnt = QTS.getTwoTotalSearchNone;
      }
      if (category.length === 1 && category[0] === 'contents') {
        qts = QTS.getTwoSearchContents;
        qtsCnt = QTS.getTwoTotalSearchContents;
      }
      if (category.length === 1 && category[0] === 'author') {
        qts = QTS.getTwoSearchAuthor;
        qtsCnt = QTS.getTwoTotalSearchAuthor;
      }
      if (category.length === 2) {
        qts = QTS.getTwoSearchBoth;
        qtsCnt = QTS.getTwoTotalSearchBoth;
      }

      qPost = await qts.fQuery({
        search,
        memberId,
        endDate,
        classId,
        isPublished,
        page,
        pageSize,
      });
      qTotal = await qtsCnt.fQuery({
        search,
        schoolId,
        isPublished,
      });
    } else if (temp) {
      qPost = await QTS.getTwoTemp.fQuery({
        memberId,
        endDate,
        isPublished,
      });
      qTotal = await QTS.getTwoTotalTemp.fQuery({
        memberId,
        isPublished,
      });
    } else {
      qPost = await QTS.getTwoElse.fQuery({
        memberId,
        schoolId,
        endDate,
        classId,
        isPublished,
        page,
        pageSize,
      });
      qTotal = await QTS.getTwoTotalElse.fQuery({
        schoolId,
        memberId,
        classId,
        isPublished,
      });
    }
  } else {
    console.log('===============', 8.6);
    if (search) {
      let qts;
      let qtsCnt;
      if (category.length === 0) {
        qts = QTS.getElseSearchNone;
        qtsCnt = QTS.getElseTotalSearchNone;
      }
      if (category.length === 1 && category[0] === 'contents') {
        qts = QTS.getElseSearchContents;
        qtsCnt = QTS.getElseTotalSearchContents;
      }
      if (category.length === 1 && category[0] === 'author') {
        qts = QTS.getElseSearchAuthor;
        qtsCnt = QTS.getElseTotalSearchAuthor;
      }
      if (category.length === 2) {
        qts = QTS.getElseSearchBoth;
        qtsCnt = QTS.getElseTotalSearchBoth;
      }

      qPost = await qts.fQuery({
        search,
        memberId,
        endDate,
        classId,
        isPublished,
        page,
        pageSize,
      });
      qTotal = await qtsCnt.fQuery({
        search,
        schoolId,
        isPublished,
      });
    } else {
      console.log('===============', 8.7);
      qPost = await QTS.getElseElse.fQuery({
        memberId,
        schoolId,
        endDate,
        classId,
        isPublished,
        page,
        pageSize,
      });
      qTotal = await QTS.getElseTotalElse.fQuery({
        schoolId,
        memberId,
        classId,
        isPublished,
      });
    }
  }

  console.log('===============', 9);
  const post = qPost.message.rows;
  console.log('===============', 10);
  console.log(qTotal);
  if (qTotal.type === 'error')
    return qTotal.onError(res, '3.2', 'searching total');

  const totalCount = qTotal.message.rows[0].count;
  let totalPage = 0;
  if (temp) totalPage = 1;
  else totalPage = Math.ceil(totalCount / pageSize);

  return RESPOND(res, {
    data: { album: post, total_count: totalCount, total_page: totalPage },
    /* datas: post,
    total_count: totalCount,
    total_page: totalPage, */
    message: '앨범 출력 성공',
    resultCode: 200,
  });
}
async function detail(req, res) {
  // #3.1. 사용자 토큰을 이용해 userId를 추출한다.
  // 이 getUserIdFromToken 함수는 user의 활성화 여부까지 판단한다.
  // userId가 정상적으로 리턴되면, 활성화된 사용자이다.
  const qUserId = await getUserIdFromToken(req.headers.authorization);
  if (qUserId.type === 'error') return qUserId.onError(res, '3.1');
  const userId = qUserId.message;

  const { member_id: memberId, id: albumId } = req.body;

  // #3.2. member 검색
  const qMember = await POST(
    'school',
    '/checkMember',
    { 'Content-Type': 'application/json' },
    { userId, memberId },
  );
  if (qMember.type === 'error')
    return qMember.onError(res, '3.2', 'fatal error while searching member');
  // const { schoolId, classId /* , grade, kidId */ } = qMember.message;

  // #3.13. 앨범데이터 조회
  const qAD = await QTS.getAlbumData.fQuery({ memberId, albumId });
  if (qAD.type === 'error')
    return qAD.onError(res, '3.13.1', 'searching album data');

  if (qAD.message.rows.length === 0)
    return ERROR(res, {
      resultCode: 400,
      message: '해당하는 앨범을 찾지 못했습니다.',
      data: { post: {}, comment: [], like: [] },
    });
  const post = qAD.message.rows[0];

  // #3.6. 댓글 구하기
  const qAllComment = await QTS.getAllComments.fQuery({ albumId });
  if (qAllComment.type === 'error')
    return qAllComment.onError(res, '3.6.1', 'searching comments');
  console.log('===============', 4);
  const comment = qAllComment.message.rows;
  // #3.7. 좋아요 구하기
  const qAllLikes = await QTS.getAllLikes.fQuery({ albumId });
  if (qAllLikes.type === 'error')
    return qAllLikes.onError(res, '3.6.1', 'searching likes');
  console.log('===============', 5);
  const like = qAllLikes.message.rows;

  return RESPOND(res, {
    data: { album: post, comment, like },
    message: '해당하는 데이터를 성공적으로 반환하였습니다.',
    resultCode: 200,
  });
}
function getFormatDate(date) {
  const year = date.getFullYear().toString();
  let month = (1 + date.getMonth()).toString();
  month = month >= 10 ? month : '0'.add(month);
  let day = date.getDate().toString();
  day = day >= 10 ? day : '0'.add(day);
  return year.add('-').add(month).add('-').add(day);
}
