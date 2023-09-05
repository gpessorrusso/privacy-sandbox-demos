/*
 Copyright 2022 Google LLC

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

      https://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License.
 */

import express, { Application, Request, Response } from "express"
import session from "express-session"

import { DSP_HOST, EXTERNAL_PORT, PORT, SHOP_DETAIL, SHOP_HOST, SSP_HOST } from "./env.js"
import { Order, addOrder, displayCategory, fromSize, getItem, getItems, removeOrder, updateOrder } from "./lib/items.js"

const app: Application = express()

declare module "express-session" {
  interface SessionData {
    cart: Order[]
  }
}

app.set("trust proxy", 1) // required for Set-Cookie with Secure
app.use(
  session({
    name: "__HOST-session_id",
    secret: "THIS IS SECRET FOR DEMO",
    resave: false,
    saveUninitialized: true,
    cookie: {
      secure: true,
      sameSite: "lax"
    }
  })
)

app.use((req, res, next) => {
  // res.setHeader("Origin-Trial", NEWS_TOKEN as string)
  res.setHeader("Cache-Control", "no-cache")
  if (!req.session.cart) {
    req.session.cart = []
  }
  next()
})
app.use(express.urlencoded({ extended: true }))
app.use(express.static("src/public"))
app.set("view engine", "ejs")
app.set("views", "src/views")

// view helper
app.locals = {
  title: SHOP_DETAIL,
  displayCategory,
  register_trigger: (order: Order) => {
    const { item, size, quantity } = order
    const register_trigger = new URL(`https://${SSP_HOST}:${EXTERNAL_PORT}`)
    register_trigger.pathname = "/register-trigger"
    register_trigger.searchParams.append("id", item.id)
    register_trigger.searchParams.append("category", `${item.category}`)
    register_trigger.searchParams.append("quantity", `${quantity}`)
    register_trigger.searchParams.append("size", `${fromSize(size)}`)
    register_trigger.searchParams.append("gross", `${item.price * quantity}`)
    return register_trigger.toString()
  }
}

app.get("/", async (req: Request, res: Response) => {
  const items = await getItems()
  res.render("index", {
    items
  })
})

app.get("/items/:id", async (req: Request, res: Response) => {
  const { id } = req.params
  const item = await getItem(id)
  const dsp_tag = new URL(`https://${DSP_HOST}:${EXTERNAL_PORT}/dsp-tag.js`)
  res.render("item", {
    item,
    dsp_tag,
    SHOP_HOST
  })
})

app.post("/cart", async (req: Request, res: Response) => {
  const { id, size, quantity } = req.body
  const item = await getItem(id)
  const order: Order = { item, size, quantity }
  const cart = addOrder(order, req.session.cart as Order[])
  req.session.cart = cart
  res.redirect(303, "/cart")
})

app.get("/cart", async (req: Request, res: Response) => {
  const cart = req.session.cart as Order[]
  const subtotal = cart.reduce((sum, { item, quantity }) => {
    return sum + item.price * quantity
  }, 0)
  const shipping = 40
  res.render("cart", {
    cart,
    subtotal,
    shipping
  })
})

app.put("/cart/:name", async (req: Request, res: Response) => {
  const { name } = req.params
  const { quantity } = req.body
  const [id, size] = name.split(":")
  const item = await getItem(id as string)
  const order: Order = {
    item,
    size,
    quantity
  }
  const cart = updateOrder(order, req.session.cart as Order[])
  req.session.cart = cart
  res.status(204).end()
})

app.delete("/cart/:name", async (req: Request, res: Response) => {
  const { name } = req.params
  const [id, size] = name.split(":")
  const item = await getItem(id as string)
  const order: Order = {
    item,
    size: size as string,
    quantity: 0
  }
  const cart = removeOrder(order, req.session.cart as Order[])
  req.session.cart = cart
  res.status(204).end()
})

app.post("/checkout", async (req: Request, res: Response) => {
  const body = req.body
  res.redirect(303, "/checkout")
})

app.get("/checkout", async (req: Request, res: Response) => {
  const cart = req.session.cart as Order[]
  const subtotal = cart.reduce((sum, { item, quantity }) => {
    return sum + item.price * quantity
  }, 0)
  const shipping = 40

  await req.session.destroy(() => Promise.resolve())
  res.render("checkout", {
    cart,
    subtotal,
    shipping
  })
})

app.listen(PORT, async () => {
  console.log(`Listening on port ${PORT}`)
})
