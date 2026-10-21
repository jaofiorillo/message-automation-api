-- CreateEnum
CREATE TYPE "FlowStatus" AS ENUM ('draft', 'live');

-- CreateEnum
CREATE TYPE "Channel" AS ENUM ('instagram', 'facebook', 'whatsapp', 'telegram');

-- CreateTable
CREATE TABLE "Flow" (
    "id" SERIAL NOT NULL,
    "ns" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "path" TEXT NOT NULL DEFAULT '/',
    "status" "FlowStatus" NOT NULL DEFAULT 'draft',
    "draft" JSONB,
    "draftCoordinates" JSONB,
    "coordinates" JSONB,
    "rootContentId" INTEGER,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Flow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FlowContent" (
    "id" SERIAL NOT NULL,
    "flowId" INTEGER NOT NULL,
    "oid" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "caption" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "targetOid" TEXT,
    "deleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FlowContent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KeywordRule" (
    "id" SERIAL NOT NULL,
    "flowId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "channel" "Channel" NOT NULL,
    "sort" INTEGER NOT NULL DEFAULT 0,
    "keywordRules" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KeywordRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Flow_ns_key" ON "Flow"("ns");

-- CreateIndex
CREATE INDEX "Flow_path_idx" ON "Flow"("path");

-- CreateIndex
CREATE UNIQUE INDEX "FlowContent_flowId_oid_key" ON "FlowContent"("flowId", "oid");

-- CreateIndex
CREATE INDEX "KeywordRule_channel_idx" ON "KeywordRule"("channel");

-- AddForeignKey
ALTER TABLE "FlowContent" ADD CONSTRAINT "FlowContent_flowId_fkey" FOREIGN KEY ("flowId") REFERENCES "Flow"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KeywordRule" ADD CONSTRAINT "KeywordRule_flowId_fkey" FOREIGN KEY ("flowId") REFERENCES "Flow"("id") ON DELETE CASCADE ON UPDATE CASCADE;

