select 
    l.id id, 
    to_char(l.created_at, 'YYYY-MM-DD"T"HH24:MI:ss.MS"Z"') created_at,
    m.id member_id, 
    f.address member_image,
    sr.grade member_grade, 
    sr.name member_type, 
    sr.id school_role_id,
    k.id kid_id,
    k.name kid_name, 
    c.id class_id, 
    c.name class_name , 
    CASE 
        WHEN sr.grade = 1 THEN concat(s.name) 
        WHEN sr.grade < 3 THEN concat(u.name,' ',sr.name) 
        WHEN sr.grade < 5 THEN concat(c.name,' ',u.name,' ','선생님') 
        WHEN sr.grade = 5 THEN concat(c.name,' ',k.name,'(',m.nickname,')') 
    END member_nickname
from likes l
    left join members m on l.member_id = m.id
    left join file f on f.id = m.image_id
    left join class c on c.id = m.class_id
    left join school_roles sr on m.school_role_id = sr.id
    left join schools s on m.school_id = s.id
    left join kid k on k.id = m.kid_id
    left join users u on u.id = m.user_id
where l.post_id = '${albumId}';