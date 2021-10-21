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
    or p.title like '%${search}%';