select 
    count(p.id)
from post p
    left join survey s on s.post_id = p.id
where 
    p.school_id = '${schoolId}' 
    and p.post_type = 1 
    and p.id in (
                    (select p.id 
                    from post p 
                        left join allowed_class ac on p.id = ac.post_id 
                        join members m on p.author_id = m.id 
                    where 
                        m.class_id in (${classes}) 
                        or ac.class_id in (${classes}) 
                        or (
                            m.id='${memberId}' 
                            and ac.post_id is null
                            )
                    )
                ) 
    and p.is_published = ${isPublished};