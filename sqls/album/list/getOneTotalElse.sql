select 
    count(p.id)
from 
    post p
where 
    p.school_id = '${schoolId}' 
    and p.post_type = 1 
    and p.is_published = ${isPublished};