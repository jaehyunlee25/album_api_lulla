import {
  RESPOND,
  ERROR,
  getUserIdFromToken,
  POST,
} from '../../../lib/apiCommon';
import setBaseURL from '../../../lib/pgConn'; // include String.prototype.fQuery

const QTS = {
  // Query TemplateS
  getAlbum: 'getAlbumById',
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

  setBaseURL('sqls/album/delete'); // 끝에 슬래시 붙이지 마시오.

  // #3.1.
  try {
    return await main(req, res);
  } catch (e) {
    return ERROR(res, {
      id: 'ERR.album.delete.3.2.2',
      message: 'post server logic error',
      error: e.toString(),
    });
  }
}
async function main(req, res) {
  // #3.1. 사용자 토큰을 이용해 userId를 추출한다.
  // 이 getUserIdFromToken 함수는 user의 활성화 여부까지 판단한다.
  // userId가 정상적으로 리턴되면, 활성화된 사용자이다.
  const qUserId = await getUserIdFromToken(req.headers.authorization);
  if (qUserId.type === 'error') return qUserId.onError(res, '3.1');
  const userId = qUserId.message;

  const { member_id: memberId, post: userAlbum } = req.body;
  const { id } = userAlbum;

  // #3.2. member 검색
  const qMember = await POST(
    'school',
    '/checkMember',
    { 'Content-Type': 'application/json' },
    { userId, memberId },
  );
  if (qMember.type === 'error')
    return qMember.onError(res, '3.2', 'fatal error while searching member');
  const { schoolId /* , grade, classId  , kidId */ } = qMember.message;

  // #3.3. 권한 검색
  const qGrade = await QTS.getDG.fQuery({ memberId });
  if (qGrade.type === 'error')
    return qGrade.onError(res, '3.3.1', 'getting grade');
  if (qGrade.message.rows.length === 0)
    return ERROR(res, {
      resultCode: '404',
      id: '3.3.2',
      message: '해당 접근권한이 없습니다.',
    });
  const { grade } = qGrade.message.rows[0];

  // #3.4. postId 제조
  const postIds = id
    .map((postId) => {
      return ["'", postId, "'"].join('');
    })
    .join(',');

  // #3.5. 포스트 추출
  const qPosts = await QTS.getPosts.fQuery({ postIds, schoolId });
  if (qPosts.type === 'error')
    return qPosts.onError(res, '3.5.1', 'getting posts');
  if (qPosts.message.rows.length === 0)
    return ERROR(res, {
      resultCode: '203',
      id: '3.5.2',
      message: '해당하는 데이터를 찾을 수 없습니다.',
    });

  // #3.6. 삭제 가능한 포스트만 골라낸다.
  const delMap = qPosts.message.rows.map((post) => {
    if (post.author_id === memberId || grade === 1) return post.id;
    return false;
  });
  const delIds = delMap.filter((postId) => {
    return postId;
  });

  // #3.7. 공지에 첨부된 파일 리스트를 구한다.
  const delPostIds = delIds
    .map((postId) => {
      return ["'", postId, "'"].join('');
    })
    .join(',');
  const qFiles = await QTS.getFiles.fQuery({ delPostIds });
  if (qFiles.type === 'error')
    return qFiles.onError(res, '3.7.1', 'getting posts');
  const fileIds = qFiles.message.rows.map((file) => {
    return file.file_id;
  });

  // #3.8. 파일을 s3에서 삭제한다.
  if (fileIds.length > 0) {
    const qS3 = await POST(
      'file',
      '/delete',
      {
        'Content-Type': 'application/json',
        Authorization: req.headers.authorization,
      },
      { file: { id: fileIds } },
    );
    if (qS3.type === 'error')
      return qS3.onError(res, '3.8.1', 'fatal error while deleting files');
  }

  // #3.9. 공지를 삭제한다.
  const qDels = await QTS.delPosts.fQuery({ delPostIds });
  if (qDels.type === 'error')
    return qDels.onError(res, '3.9.1', 'getting posts');

  return RESPOND(res, {
    message: '파일 삭제 성공',
    resultCode: 200,
  });
}
