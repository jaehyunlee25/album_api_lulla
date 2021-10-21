select 
    count(p.id)
from post p 
where 
    p.post_type = 1 
    -- allowed_member_compare
    and 1 = (select count(*) 
            from allowed_member am 
            where 
                am.post_id = p.id 
                and am.member_id = '${memberId}')
    -- allowed_class_compare
    or 1 = (select count(*) 
        from allowed_class ac 
        where 
            ac.post_id = p.id 
            and ac.class_id = '${classId}'
        )
    and p.is_published = ${isPublished}
    -- contents 검색
    and p.contents like '%${search}%' 
    or p.title like '%${search}%';