select ta.id as assignment_id, ta.class_id, c.class_name, ta.section_id, s.section_name,
       ta.subject_id, sub.subject_name, ta.assignment_type, ta.is_active, ta.academic_year_id
from teacher_assignments ta
left join classes c on c.id = ta.class_id
left join sections s on s.id = ta.section_id
left join subjects sub on sub.id = ta.subject_id
where ta.teacher_id = '26defd66-64da-472d-b05b-7f80b469ced8'
order by c.class_name, s.section_name, sub.subject_name;
