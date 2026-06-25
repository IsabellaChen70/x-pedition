import courseJson from '../../content/course.json';
import type { Course, Lesson } from '../types/lesson';

const lessonModules = import.meta.glob<Lesson>('../../content/lessons/*.json', {
  eager: true,
  import: 'default',
});

const course = courseJson as Course;

export function getCourse(): Course {
  return course;
}

export function getLesson(lessonId: string): Lesson | null {
  const match = Object.entries(lessonModules).find(([path]) => path.endsWith(`/${lessonId}.json`));
  return match ? match[1] : null;
}

export function listLessons(): Array<{ id: string; title: string; description: string }> {
  return course.lessonOrder.map((id) => ({
    id,
    title: course.lessons[id]?.title ?? id,
    description: course.lessons[id]?.description ?? '',
  }));
}

export function getNextLesson(
  lessonId: string,
): { id: string; title: string; description: string } | null {
  const index = course.lessonOrder.indexOf(lessonId);
  if (index === -1 || index >= course.lessonOrder.length - 1) {
    return null;
  }
  const nextId = course.lessonOrder[index + 1];
  const meta = course.lessons[nextId];
  if (!meta) {
    return null;
  }
  return { id: nextId, title: meta.title, description: meta.description };
}
