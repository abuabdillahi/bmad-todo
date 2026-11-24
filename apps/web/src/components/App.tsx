import { AddForm } from './AddForm.tsx';
import styles from './App.module.css';
import { TodoList } from './TodoList.tsx';

export function App() {
  return (
    <div className={styles.app}>
      <main className={styles.page}>
        <h1 className={styles.heading} tabIndex={-1}>
          BMad Todos
        </h1>
        <AddForm />
        <TodoList />
      </main>
    </div>
  );
}
