import { useRef } from 'react';
import { AddForm } from './AddForm.tsx';
import { Announcer } from './Announcer.tsx';
import styles from './App.module.css';
import { TodoList } from './TodoList.tsx';

export function App() {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const addFieldRef = useRef<HTMLTextAreaElement>(null);

  return (
    <div className={styles.app}>
      <main className={styles.page}>
        <Announcer focusTargets={{ heading: headingRef, addField: addFieldRef }} />
        <h1 ref={headingRef} className={styles.heading} tabIndex={-1}>
          BMad Todos
        </h1>
        <AddForm fieldRef={addFieldRef} />
        <TodoList />
      </main>
    </div>
  );
}
