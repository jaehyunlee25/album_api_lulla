select 
    count(p.id)
from post p 
    left join survey s on s.post_id = p.id
where 
    p.post_type = 1 
    and p.school_id = '${schoolId}'
    and p.is_published = ${isPublished}
    -- contents 검색
    and p.contents like '%${search}%' 
    or p.title like '%${search}%'
    -- author 검색
    or p.author_id 
        in (select m.id 
            from members m 
            where m.nickname like '%${search}%') 
    or p.author_id 
        in (select m.id 
            from members m 
                join kid k on k.id = m.kid_id
            where k.name like '%${search}%') 
    or p.author_id 
        in (select m.id 
            from members m 
                join class c on c.id = m.class_id 
            where c.name like '%${search}%');