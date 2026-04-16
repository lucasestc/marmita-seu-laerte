import { redirect } from 'next/navigation'

// The canonical menu URL is /menu. Redirect visitors who land on / there.
export default function Home() {
  redirect('/menu')
}
