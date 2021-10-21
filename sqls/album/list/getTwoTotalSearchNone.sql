select 
    count(p.id)
from post p 
where 
    p.post_type = 1 
    and p.author_id = '${memberId}' 
    -- allowed_class_compare
    or 1 = (select count(*) 
        from allowed_class ac 
        where 
            ac.post_id = p.id 
            and ac.class_id = '${classId}'
        )
    and p.is_published = ${isPublished};