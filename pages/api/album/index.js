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
  setAlbum: 'setAlbum',
  setAlbumPub: 'setAlbumPub',
  delAM: 'delAllowedMember',
  newAMs: 'newAllowedMembers',
  delAC: 'delAllowedClass',
  newACs: 'newAllowedClasses',
  getPF: 'getPostFile',
  newPF: 'newPostFile',
  getAlbumData: 'getAlbumData',
  getAllComments: 'getAllComments',
  getAllLikes: 'getAllLikes',
  newAlbum: 'newAlbum',
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

  setBaseURL('sqls/album/album'); // 끝에 슬래시 붙이지 마시오.

  // #3.1.
  try {
    return await main(req, res);
  } catch (e) {
    return ERROR(res, {
      id: 'ERR.album.album.3.2.2',
      message: 'post server logic error',
      error: e.toString(),
    });
  }
}
async function main(req, res) {
  if (req.body.album.id) return updateAlbum(req, res);
  // #3.1. 사용자 토큰을 이용해 userId를 추출한다.
  // 이 getUserIdFromToken 함수는 user의 활성화 여부까지 판단한다.
  // userId가 정상적으로 리턴되면, 활성화된 사용자이다.
  const qUserId = await getUserIdFromToken(req.headers.authorization);
  if (qUserId.type === 'error') return qUserId.onError(res, '3.1');
  const userId = qUserId.message;

  const { member_id: memberId, album: userAlbum } = req.body;
  const {
    title,
    contents,
    important,
    is_published: isPublished, // 푸쉬알림 관련
    allowed_member: allowedMember,
    file_list: fileList,
    deleted_list: deletedList,
  } = userAlbum;
  let { allowed_class: allowedClass } = userAlbum;

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

  // #3.3. album 생성
  const qNew = await QTS.newAlbum.fQuery({
    important,
    title,
    contents,
    memberId,
    schoolId,
  });
  if (qNew.type === 'error')
    return qNew.onError(res, '3.3.1', 'creating album');
  const albumId = qNew.message.rows[0].id;

  // #3.3.2 발행여부 수정
  if (isPublished) {
    const qSetPub = await QTS.setAlbumPub.fQuery({ albumId });
    if (qSetPub.type === 'error')
      return qSetPub.onError(res, '3.5.1', 'searching album');
  }

  // #3.4. allowed_member 저장
  if (allowedMember) {
    // #3.4.1. 저장
    const arMemberValues = allowedMember.map((allowedMemberId) => {
      return `(now(), now(), '${allowedMemberId}', '${albumId}')`;
    });
    const memberValues = arMemberValues.join(',\r\n');
    const qAM = await QTS.newAMs.fQuery({ memberValues });
    if (qAM.type === 'error')
      return qAM.onError(res, '3.4.1', 'creating allowed members');
  }

  // #3.5. allowed_class 저장
  if (!allowedMember && !allowedClass && classId) allowedClass = [classId];
  if (allowedClass) {
    // #3.5.2. 저장
    if (classId && !allowedClass.includes(classId)) allowedClass.push(classId);
    const arClassValues = allowedClass.map((allowedClassId) => {
      return `(now(), now(), '${allowedClassId}', '${albumId}')`;
    });
    const classValues = arClassValues.join(',\r\n');
    const qAC = await QTS.newACs.fQuery({ classValues });
    if (qAC.type === 'error')
      return qAC.onError(res, '3.5.2', 'creating allowed classes');
  }

  // #3.6. fileList 처리
  if (fileList) {
    fileList.forEach(async (fileId) => {
      const qPF = await QTS.getPF.fQuery({ fileId, albumId });
      if (qPF.type === 'error')
        return qPF.onError(res, '3.6.1', 'searching file');
      /* if (qPF.message.rows.length > 0)
        return RESPOND(res, {
          message: '게시물 저장에 성공했습니다.',
          resultCode: 200,
        }); */

      const qUPF = await QTS.newPF.fQuery({ fileId, albumId });
      if (qUPF.type === 'error')
        return qUPF.onError(res, '3.6.2', 'creating file');

      /* if (i === fileList.length - 1)
        return RESPOND(res, {
          message: '게시물 저장에 성공했습니다.',
          resultCode: 200,
        }); */
      return true;
    });
  }

  // #3.7. deletedList 처리
  if (deletedList) {
    const qDels = await POST(
      'file',
      '/delete',
      { 'Content-Type': 'application/json' },
      { file: { id: deletedList } },
    );
    if (qDels.type === 'error')
      return qDels.onError(res, '3.2', 'fatal error while searching member');
  }

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

  // #3.14. 댓글 조회
  const qACs = await QTS.getAllComments.fQuery({ albumId });
  if (qACs.type === 'error')
    return qACs.onError(res, '3.14.1', 'searching comments');
  const comment = qACs.message.rows;

  // #3.15. 좋아요 조회
  const qALs = await QTS.getAllLikes.fQuery({ albumId });
  if (qALs.type === 'error')
    return qALs.onError(res, '3.14.1', 'searching likes');
  const like = qALs.message.rows;

  return RESPOND(res, {
    data: { album: post, comment, like },
    message: '게시물 저장에 성공했습니다.',
    resultCode: 200,
  });
}
async function updateAlbum(req, res) {
  const qUserId = await getUserIdFromToken(req.headers.authorization);
  if (qUserId.type === 'error') return qUserId.onError(res, '3.1');
  const userId = qUserId.message;

  const { member_id: memberId, album: userAlbum } = req.body;
  const {
    title,
    contents,
    important,
    is_published: isPublished, // 푸쉬알림 관련
    allowed_member: allowedMember,
    file_list: fileList,
    deleted_list: deletedList,
    id: albumId,
  } = userAlbum;
  let { allowed_class: allowedClass } = userAlbum;

  // #3.2. member 검색
  const qMember = await POST(
    'school',
    '/checkMember',
    { 'Content-Type': 'application/json' },
    { userId, memberId },
  );
  if (qMember.type === 'error')
    return qMember.onError(res, '3.2', 'fatal error while searching member');
  const { classId /* schoolId, grade, kidId */ } = qMember.message;

  // #3.3. album 검색
  const qAlbum = await QTS.getAlbum.fQuery({ albumId });
  if (qAlbum.type === 'error')
    return qAlbum.onError(res, '3.2', 'searching album');
  const album = qAlbum.message.rows[0];
  if (album.author_id !== memberId)
    return ERROR(res, {
      id: '3.3.1',
      resultCode: 401,
      message: '수정은 작성자만이 가능합니다.',
    });

  // #3.4. album 공통 수정
  if (contents) album.contents = contents;
  if (title) album.title = title;
  if (important) album.important = important;
  if (album.is_published) album.is_modified = true;

  const qSet = await QTS.setAlbum.fQuery({
    title: album.title,
    contents: album.contents,
    important: album.important,
    is_modified: album.is_modified,
    albumId,
  });
  if (qSet.type === 'error')
    return qSet.onError(res, '3.4.1', 'searching album');

  // #3.5. 발행여부 수정
  if (isPublished) {
    const qSetPub = await QTS.setAlbumPub.fQuery({ albumId });
    if (qSetPub.type === 'error')
      return qSetPub.onError(res, '3.5.1', 'searching album');
  }

  if (allowedMember) {
    // #3.6. 기존의 allowedMember 삭제
    const qDelAM = await QTS.delAM.fQuery({ albumId });
    if (qDelAM.type === 'error')
      return qDelAM.onError(res, '3.6.1', 'deleting allowed members');

    // #3.7. 새 allowedMember 입력
    const arMemberValues = allowedMember.map((allowedMemberId) => {
      return `(now(), now(), '${allowedMemberId}', '${albumId}')`;
    });
    const memberValues = arMemberValues.join(',\r\n');
    const qAM = await QTS.newAMs.fQuery({ memberValues });
    if (qAM.type === 'error')
      return qAM.onError(res, '3.7.1', 'creating allowed members');
  }

  if (!allowedMember && !allowedClass && classId) allowedClass = [classId];
  if (allowedClass) {
    // #3.9. 기존의 allowedClass 삭제
    const qDelAC = await QTS.delAC.fQuery({ albumId });
    if (qDelAC.type === 'error')
      return qDelAC.onError(res, '3.9.1', 'deleting allowed class');

    // #3.10. 새 allowedClass 입력
    if (classId && !allowedClass.includes(classId)) allowedClass.push(classId);
    const arClassValues = allowedClass.map((allowedClassId) => {
      return `(now(), now(), '${allowedClassId}', '${albumId}')`;
    });
    const classValues = arClassValues.join(',\r\n');
    const qAC = await QTS.newACs.fQuery({ classValues });
    if (qAC.type === 'error')
      return qAC.onError(res, '3.10.1', 'creating allowed classes');
  }

  // #3.11. fileList 처리
  if (fileList) {
    fileList.forEach(async (fileId) => {
      const qPF = await QTS.getPF.fQuery({ fileId, albumId });
      if (qPF.type === 'error')
        return qPF.onError(res, '3.11.1', 'searching file');
      if (qPF.message.rows.length > 0) return true;

      const qUPF = await QTS.newPF.fQuery({ fileId, albumId });
      if (qUPF.type === 'error')
        return qUPF.onError(res, '3.11.2', 'creating file');

      /* if (i === fileList.length - 1)
        return RESPOND(res, {
          message: '게시물 수정에 성공했습니다.',
          resultCode: 200,
        }); */
      return true;
    });
  }

  // #3.12. 삭제된 파일 처리
  if (deletedList) {
    const qDels = await POST(
      'file',
      '/delete',
      { 'Content-Type': 'application/json' },
      { file: { id: deletedList } },
    );
    if (qDels.type === 'error')
      return qDels.onError(res, '3.12.1', 'fatal error while searching member');
  }

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

  // #3.14. 댓글 조회
  const qACs = await QTS.getAllComments.fQuery({ albumId });
  if (qACs.type === 'error')
    return qACs.onError(res, '3.14.1', 'searching comments');
  const comment = qACs.message.rows;

  // #3.15. 좋아요 조회
  const qALs = await QTS.getAllLikes.fQuery({ albumId });
  if (qALs.type === 'error')
    return qALs.onError(res, '3.14.1', 'searching likes');
  const like = qALs.message.rows;

  return RESPOND(res, {
    data: { album: post, comment, like },
    message: '앨범을 수정했습니다.',
    resultCode: 200,
  });
}
