/*
  Warnings:

  - You are about to drop the `Attachment` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Attachment" DROP CONSTRAINT "Attachment_taskId_fkey";

-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "attachments" JSONB NOT NULL DEFAULT '[]';

-- DropTable
DROP TABLE "Attachment";
