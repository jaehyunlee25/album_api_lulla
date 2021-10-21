select 
    count(p.id)
from 
    post p
where 
    p.author_id = '${memberId}' 
    and p.post_type = 1 
    and p.is_published = ${isPublished};