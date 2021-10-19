import {
  RESPOND,
  ERROR,
  getUserIdFromToken,
  POST,
} from '../../../lib/apiCommon';
import setBaseURL from '../../../lib/pgConn'; // include String.prototype.fQuery

const QTS = {
  // Query TemplateS
  newPost: 'newPost',
  newAMs: 'newAllowedMembers',
  newACs: 'newAllowedClasses',
  getSurvey: 'getSurvey',
  setSurvey: 'setSurvey',
  getPF: 'getPostFile',
  newPF: 'newPostFile',
  setPost: 'setPost',
  setPostDetail: 'setPostDetail',
  delAM: 'delAllowedMember',
  delAC: 'delAllowedClass',
  getPost: 'getPostById',
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

  setBaseURL('sqls/post/post'); // 끝에 슬래시 붙이지 마시오.

  // #3.1.
  try {
    return await main(req, res);
  } catch (e) {
    return ERROR(res, {
      id: 'ERR.post.index.3.2.2',
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

  const { member_id: memberId, post: userPost } = req.body;
  const {
    id,
    title,
    contents,
    important,
    post_type: postType,
    allowed_member: allowedMember,
    survey_id: surveyId,
    file_list: fileList,
    is_published: isPublished, // 푸쉬알림 관련
  } = userPost;
  let { allowed_class: allowedClass } = userPost;
  const mode = id ? 'update' : 'create';

  // #3.2. member 검색
  const qMember = await POST(
    'school',
    '/checkMember',
    { 'Content-Type': 'application/json' },
    { userId, memberId },
  );
  if (qMember.type === 'error')
    return qMember.onError(res, '3.2', 'fatal error while searching member');
  const { schoolId, grade, classId /* , kidId */ } = qMember.message;

  // #3.3. 권한 검사
  if (grade > 3)
    return ERROR(res, {
      type: 'error',
      resultCode: 401,
      message: '해당하는 권한이 존재하지 않습니다.',
    });

  // #3.4. 포스트 저장
  let postId;
  if (mode === 'update') {
    postId = id;
    const qUp = await updatePost(postId, {
      memberId,
      important,
      title,
      contents,
      isPublished,
    });
    if (qUp.type === 'error')
      return ERROR(res, {
        resultCode: '404',
        id: qUp.id,
        type: 'error',
        eStr: qUp.eStr,
        message: qUp.message,
      });
  } else {
    const qPost = await QTS.newPost.fQuery({
      title,
      contents,
      memberId,
      schoolId,
      postType,
      important,
      isPublished: isPublished === undefined ? null : isPublished,
      publishedTime: isPublished === undefined ? null : 'now()',
    });
    if (qPost.type === 'error')
      return qPost.onError(res, '3.4', 'creating post');
    postId = qPost.message.rows[0].id;
  }

  // #3.5. allowed_member 저장
  if (allowedMember) {
    // #3.5.1. 공지 수정작업이면, 기존의 allowed member 정보를 삭제한다.
    if (mode === 'update') {
      const qDelAM = await QTS.delAM.fQuery({ postId });
      if (qDelAM.type === 'error')
        return qDelAM.onError(res, '3.5.1', 'deleting allowed members');
    }
    // #3.5.2. 저장
    const arMemberValues = allowedMember.map((allowedMemberId) => {
      return `(now(), now(), '${allowedMemberId}', '${postId}')`;
    });
    const memberValues = arMemberValues.join(',\r\n');
    const qAM = await QTS.newAMs.fQuery({ memberValues });
    if (qAM.type === 'error')
      return qAM.onError(res, '3.5.2', 'creating allowed members');
  }

  // #3.6. allowed_class 저장
  if (!allowedMember && !allowedClass && classId) allowedClass = [classId];
  if (allowedClass) {
    // #3.6.1. 공지 수정작업이면, 기존의 allowed class 정보를 삭제한다.
    if (mode === 'update') {
      const qDelAC = await QTS.delAC.fQuery({ postId });
      if (qDelAC.type === 'error')
        return qDelAC.onError(res, '3.6.1', 'deleting allowed class');
    }
    // #3.6.2. 저장
    if (classId && !allowedClass.includes(classId)) allowedClass.push(classId);
    const arClassValues = allowedClass.map((allowedClassId) => {
      return `(now(), now(), '${allowedClassId}', '${postId}')`;
    });
    const classValues = arClassValues.join(',\r\n');
    const qAC = await QTS.newACs.fQuery({ classValues });
    if (qAC.type === 'error')
      return qAC.onError(res, '3.6.2', 'creating allowed classes');
  }

  // #3.7. survey 처리
  if (surveyId) {
    const qGS = await QTS.getSurvey.fQuery({ surveyId });
    if (qGS.type === 'error')
      return qGS.onError(res, '3.7.1', 'creating survey');
    if (qGS.message.rows.length === 0)
      return ERROR(res, {
        resultCode: 401,
        message: '해당하는 설문이 없습니다.',
        id: 'ERR.post.index.3.7.2',
      });
    const qUS = await QTS.setSurvey.fQuery({ surveyId, postId });
    if (qUS.type === 'error')
      return qUS.onError(res, '3.7.3', 'updating survey');
  }

  // #3.8. fileList 처리
  if (fileList) {
    fileList.forEach(async (fileId, i) => {
      const qPF = await QTS.getPF.fQuery({ fileId, postId });
      if (qPF.type === 'error')
        return qPF.onError(res, '3.8', 'searching post_file');
      if (qPF.message.rows.length > 0)
        return RESPOND(res, {
          message: '게시물 저장에 성공했습니다.',
          resultCode: 200,
        });

      const qUPF = await QTS.newPF.fQuery({ fileId, postId });
      if (qUPF.type === 'error')
        return qUPF.onError(res, '3.8', 'searching post_file');

      if (i === fileList.length - 1)
        return RESPOND(res, {
          message: '게시물 저장에 성공했습니다.',
          resultCode: 200,
        });
      return true;
    });
  }

  // #3.9. 임시저장 여부 처리
  // 푸쉬알림
  /* if (isPublished) {
    const qSP = await QTS.setPost.fQuery({ postId, isPublished });
    if (qSP.type === 'error') return qSP.onError(res, '3.9.1', 'updating post');

    let pushType;
    if (allowedClass || allowedMember) pushType = 3;
    else if (classId) pushType = 2;
    else pushType = 1;

    const qNick = await QTS.getNick.fQuery({ memberId });
    if (qNick.type === 'error')
      return qNick.onError(res, '3.9.2', 'getting nickname');
    const { nickname } = qNick.message.rows[0];
  } */

  return true;
  /* return RESPOND(res, {
    message: '게시물 저장에 성공했습니다.',
    resultCode: 200,
  }); */
}
async function updatePost(postId, param) {
  const { memberId, important, title, contents, isPublished } = param;
  // #3.4.1. 해당 포스트 찾기
  const qPost = await QTS.getPost.fQuery({ postId });
  if (qPost.type === 'error')
    return {
      id: 'ERR.post.update.3.4.1.',
      message: '해당 공지를 찾는 중에 에러가 발생했습니다.',
      eStr: qPost.eStr,
    };
  // #3.4.1.1.
  if (qPost.message.rows.length === 0)
    return {
      id: 'ERR.post.update.3.4.1.1.',
      message: '해당 공지를 찾는 중에 에러가 발생했습니다.',
      eStr: qPost.eStr,
    };
  // #3.4.1.2.
  const authorId = qPost.message.rows[0].author_id;
  if (authorId !== memberId)
    return {
      id: 'ERR.post.update.3.4.1.2.',
      message: '글 수정은 해당 글을 작성한 사람만 가능합니다.',
      eStr: qPost.eStr,
    };

  // #3.4.2. 포스트 수정
  const isModified = isPublished;
  const qUp = await QTS.setPostDetail.fQuery({
    postId,
    title,
    contents,
    important,
    isPublished: isPublished === undefined ? null : isPublished,
    publishedTime: isPublished === undefined ? null : 'now()',
    isModified,
  });
  if (qUp.type === 'error')
    return {
      id: 'ERR.post.update.3.4.2.1',
      message: '공지를 수정하는 중에 에러가 발생했습니다.',
      eStr: qUp.sStr,
      returnType: 401,
    };

  return true;
}
