select 
    cm.id id,cm.content, 
    cm.is_modified is_modified,
    cm.is_deleted is_deleted,
    to_char(cm.created_at, 'YYYY-MM-DD"T"HH24:MI:ss.MS"Z"') created_at,
    to_char(cm.updated_at, 'YYYY-MM-DD"T"HH24:MI:ss.MS"Z"') updated_at, 
    m.id member_id,
    CASE 
        WHEN sr.grade = 1 THEN concat(s.name) 
        WHEN sr.grade < 3 THEN concat(u.name,' ',sr.name) 
        WHEN sr.grade < 5 THEN concat(c.name,' ',u.name,' ','선생님') 
        WHEN sr.grade = 5 THEN concat(c.name,' ',k.name,'(',m.nickname,')') 
    END member_nickname,
    f.address member_image,
    sr.grade member_grade,
    sr.name member_type, 
    sr.id school_role_id,
    k.id kid_id, 
    k.name kid_name, 
    c.id class_id, 
    c.name class_name,
    tm.id target_member_id, 
    tm.nickname target_member_nickname, 
    tc.name target_class_name,
    tk.name target_kid_name, 
    tsr.name target_member_type, 
    tsr.grade target_member_grade,
    CASE 
        WHEN tsr.grade = 1 THEN concat(ts.name) 
        WHEN tsr.grade < 3 THEN concat(tu.name,' ',tsr.name) 
        WHEN tsr.grade < 5 THEN concat(tc.name,' ',tu.name,' ','선생님') 
        WHEN tsr.grade = 5 THEN concat(tc.name,' ',tk.name,'(',tm.nickname,')') 
    END target_member_nickname,
    (select array_to_json(
        array(
            select row_to_json(tmp) 
            from (select 
                    dc.id, 
                    dc.content, 
                    dc.is_modified is_modified, 
                    dc.is_deleted is_deleted,
                    to_char(dc.created_at, 'YYYY-MM-DD"T"HH24:MI:ss.MS"Z"') created_at,
                    to_char(dc.updated_at,'YYYY-MM-DD"T"HH24:MI:ss.MS"Z"') updated_at,fm.id member_id,
                    CASE 
                        WHEN fsr.grade = 1 THEN concat(sf.name) 
                        WHEN fsr.grade < 3 THEN concat(fu.name,' ',fsr.name) 
                        WHEN fsr.grade < 5 THEN concat(fc.name,' ',fu.name,' ','선생님') 
                        WHEN fsr.grade = 5 THEN concat(fc.name,' ',fk.name,'(',fm.nickname,')') 
                    END member_nickname,
                    fmf.address member_image, 
                    fsr.grade member_grade,
                    fsr.name member_type, 
                    fsr.id school_role_id,
                    fk.id kid_id, 
                    fk.name kid_name, 
                    fc.id class_id, 
                    fc.name class_name,
                    ttm.id target_member_id, 
                    ttm.nickname target_member_nickname,
                    ttc.name target_class_name, 
                    ttsr.name target_member_type, 
                    ttsr.grade target_member_grade,
                    ttk.name target_kid_name,
                    CASE 
                        WHEN ttsr.grade = 1 THEN concat(tts.name) 
                        WHEN ttsr.grade < 3 THEN concat(ttu.name,' ',ttsr.name) 
                        WHEN ttsr.grade < 5 THEN concat(ttc.name,' ',ttu.name,' ','선생님') 
                        WHEN ttsr.grade = 5 THEN concat(ttc.name,' ',ttk.name,'(',tm.nickname,')') 
                    END target_member_nickname
                from comment dc
                    left join tocomment tc on dc.id = tc.tocomment_id
                    left join members fm on fm.id = dc.member_id
                    left join schools sf on sf.id = fm.school_id
                    left join class fc on fc.id = fm.class_id
                    left join kid fk on fk.id = fm.kid_id
                    left join users fu on fu.id = fm.user_id
                    left join school_roles fsr on fm.school_role_id = fsr.id
                    left join members ttm on dc.target_member_id = ttm.id
                    left join schools tts on tts.id = ttm.school_id
                    left join class ttc on ttc.id = ttm.class_id
                    left join school_roles ttsr on ttsr.id = ttm.school_role_id
                    left join kid ttk on ttk.id = ttm.kid_id
                    left join users ttu on ttu.id = ttm.user_id
                    left join file fmf on fm.image_id = fmf.id where tc.comment_id = cm.id order by dc.created_at asc )tmp
            )
        ) tocomment
    )
from comment cm
    left join members tm on cm.target_member_id = tm.id
    left join schools ts on tm.school_id = ts.id
    left join class tc on tc.id =tm.class_id
    left join kid tk on tk.id = tm.kid_id
    left join school_roles tsr on tsr.id = tm.school_role_id 
    left join members m on cm.member_id = m.id
    left join users u on u.id = m.user_id
    left join schools s on s.id = m.school_id
    left join file f on f.id = m.image_id
    left join class c on c.id = m.class_id
    join school_roles sr on m.school_role_id = sr.id
    left join kid k on k.id = m.kid_id
    left join users tu on tu.id = tm.user_id
where cm.post_id = '${albumId}' 
order by cm.created_at asc;